"""
Devora21 resume archive API.

POST /resume/archive
  - Saves DOCX, appends CSV row, converts to PDF, returns JSON with pdfBase64.

Requires LibreOffice for PDF conversion:
  Ubuntu: sudo apt install libreoffice-writer
  Windows: install LibreOffice and ensure soffice is on PATH
"""

from __future__ import annotations

import base64
import csv
import os
import shutil
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

APP_DIR = Path(__file__).resolve().parent
STORAGE_DIR = APP_DIR / "storage"
RESUMES_DIR = STORAGE_DIR / "resumes"
CSV_PATH = STORAGE_DIR / "resume_log.csv"
MAX_FILE_BYTES = 10 * 1024 * 1024
CSV_HEADER = ["datetime", "job_title", "company_name", "job_description", "resume_name"]
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_MODEL = "deepseek-v4-pro"
DEEPSEEK_MAX_TOKENS = 16384

_generate_jobs: dict[str, dict] = {}
_generate_lock = threading.Lock()

app = Flask(__name__)
CORS(
    app,
    origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://devora21-dev.netlify.app",
    ],
    methods=["GET", "POST", "OPTIONS"],
)


def safe_resume_filename(name: str) -> str:
    """Allow alphanumerics plus . _ - , for tailored resume names."""
    base = Path(name).name
    if not base:
        return "resume.docx"
    cleaned = "".join(c for c in base if c.isalnum() or c in "._-,")
    if not cleaned.lower().endswith(".docx"):
        cleaned = f"{cleaned}.docx" if cleaned else "resume.docx"
    return cleaned


def find_soffice() -> str | None:
    env = os.environ.get("LIBREOFFICE_PATH")
    if env and Path(env).exists():
        return env
    for candidate in (
        "soffice",
        "libreoffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ):
        found = shutil.which(candidate) if not candidate.endswith(".exe") else (
            candidate if Path(candidate).exists() else None
        )
        if found:
            return found
    return None


def call_deepseek(messages: list) -> str:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set on the backend server.")

    response = requests.post(
        DEEPSEEK_API_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "max_tokens": DEEPSEEK_MAX_TOKENS,
            "stream": False,
            "response_format": {"type": "json_object"},
            "thinking": {"type": "disabled"},
        },
        timeout=120,
    )
    response.raise_for_status()
    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "").strip()
    if not content:
        raise RuntimeError("Empty response from DeepSeek.")
    return content


def run_generate_job(job_id: str, messages: list) -> None:
    try:
        text = call_deepseek(messages)
        with _generate_lock:
            _generate_jobs[job_id] = {"status": "done", "text": text}
    except Exception as exc:
        with _generate_lock:
            _generate_jobs[job_id] = {"status": "error", "message": str(exc)}


def append_csv_row(
    dt: str,
    job_title: str,
    company_name: str,
    job_description: str,
    resume_name: str,
) -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    write_header = not CSV_PATH.exists() or CSV_PATH.stat().st_size == 0
    with CSV_PATH.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        if write_header:
            writer.writerow(CSV_HEADER)
        writer.writerow([dt, job_title, company_name, job_description, resume_name])


def convert_docx_to_pdf(docx_path: Path) -> Path:
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError(
            "LibreOffice not found. Install LibreOffice or set LIBREOFFICE_PATH."
        )

    out_dir = docx_path.parent
    cmd = [
        soffice,
        "--headless",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        str(out_dir),
        str(docx_path),
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"PDF conversion failed: {result.stderr or result.stdout or 'unknown error'}"
        )

    pdf_path = docx_path.with_suffix(".pdf")
    if not pdf_path.exists():
        raise RuntimeError("PDF conversion completed but output file was not created.")
    return pdf_path


@app.get("/health")
def health():
    return jsonify(
        status="ok",
        libreoffice=find_soffice() is not None,
        deepseek=bool(os.environ.get("DEEPSEEK_API_KEY")),
    )


@app.post("/resume/generate")
def start_resume_generate():
    data = request.get_json(silent=True) or {}
    messages = data.get("messages")
    if not isinstance(messages, list) or not messages:
        return jsonify(error="messages array is required."), 400

    job_id = str(uuid.uuid4())
    with _generate_lock:
        _generate_jobs[job_id] = {"status": "pending"}

    thread = threading.Thread(target=run_generate_job, args=(job_id, messages), daemon=True)
    thread.start()
    return jsonify(jobId=job_id)


@app.get("/resume/generate/<job_id>")
def resume_generate_status(job_id: str):
    with _generate_lock:
        job = _generate_jobs.get(job_id)

    if not job:
        return jsonify(error="Job not found."), 404

    if job.get("status") == "pending":
        return jsonify(status="pending")
    if job.get("status") == "error":
        return jsonify(status="error", message=job.get("message", "Generation failed."))
    if job.get("status") == "done":
        return jsonify(status="done", text=job.get("text", ""))

    return jsonify(error="Unknown job status."), 500


@app.post("/resume/archive")
def archive_resume():
    job_title = (request.form.get("jobTitle") or "").strip()
    company_name = (request.form.get("companyName") or "").strip()
    job_description = (request.form.get("jobDescription") or "").strip()
    dt = (request.form.get("datetime") or "").strip() or datetime.now(timezone.utc).isoformat()
    resume_file_name = safe_resume_filename(
        (request.form.get("resumeFileName") or "").strip()
    )
    upload = request.files.get("resume")

    if not job_title:
        return jsonify(error="jobTitle is required."), 400
    if not company_name:
        return jsonify(error="companyName is required."), 400
    if upload is None or not upload.filename:
        return jsonify(error="resume DOCX file is required."), 400

    raw = upload.read()
    if not raw:
        return jsonify(error="resume DOCX file is empty."), 400
    if len(raw) > MAX_FILE_BYTES:
        return jsonify(error="resume file exceeds size limit."), 413
    if not raw[:2] == b"PK":
        return jsonify(error="resume must be a valid .docx file."), 422

    if not resume_file_name or resume_file_name == "resume.docx":
        resume_file_name = safe_resume_filename(upload.filename)

    date_prefix = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    target_dir = RESUMES_DIR / date_prefix
    target_dir.mkdir(parents=True, exist_ok=True)

    docx_path = target_dir / resume_file_name
    if docx_path.exists():
        stem = docx_path.stem
        suffix = docx_path.suffix
        stamp = datetime.now(timezone.utc).strftime("%H%M%S")
        resume_file_name = f"{stem}_{stamp}{suffix}"
        docx_path = target_dir / resume_file_name

    docx_path.write_bytes(raw)

    try:
        append_csv_row(dt, job_title, company_name, job_description, resume_file_name)
        pdf_path = convert_docx_to_pdf(docx_path)
        pdf_bytes = pdf_path.read_bytes()
    except Exception as exc:
        return jsonify(error=str(exc)), 422

    pdf_file_name = pdf_path.name
    return jsonify(
        resumeName=resume_file_name,
        pdfFileName=pdf_file_name,
        pdfBase64=base64.b64encode(pdf_bytes).decode("ascii"),
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
