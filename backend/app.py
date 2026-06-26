"""
Devora21 resume archive API.

POST /resume/archive
  - Saves DOCX, appends CSV row, converts to PDF, returns JSON with pdfBase64.

GET /resume/archives?q=
  - Lists saved resumes for the authenticated user (newest bid first).

GET /resume/archives/<id>/docx
GET /resume/archives/<id>/pdf
  - Download stored files.

Requires LibreOffice for PDF conversion:
  Ubuntu: sudo apt install libreoffice-writer
  Windows: install LibreOffice and ensure soffice is on PATH
"""

from __future__ import annotations

import base64
import csv
import json
import os
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

APP_DIR = Path(__file__).resolve().parent
STORAGE_DIR = APP_DIR / "storage"
RESUMES_DIR = STORAGE_DIR / "resumes"
CSV_PATH = STORAGE_DIR / "resume_log.csv"
INDEX_PATH = STORAGE_DIR / "archives_index.json"
MAX_FILE_BYTES = 10 * 1024 * 1024
CSV_HEADER = ["datetime", "job_title", "company_name", "job_description", "resume_name"]

app = Flask(__name__)
CORS(
    app,
    origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://devora21-dev.netlify.app",
        "https://devora21.com",
        "https://www.devora21.com",
    ],
    methods=["GET", "POST", "OPTIONS"],
    supports_credentials=True,
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


def resolve_user_id() -> str:
    """Production: derive from session/JWT. Dev stub uses a fixed user."""
    return (request.headers.get("X-User-Id") or "dev-user").strip() or "dev-user"


def load_index() -> list[dict]:
    if not INDEX_PATH.exists():
        return []
    try:
        data = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def save_index(records: list[dict]) -> None:
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")


def find_archive(archive_id: str, user_id: str) -> dict | None:
    for row in load_index():
        if row.get("id") == archive_id and row.get("user_id") == user_id:
            return row
    return None


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


def archive_matches_query(row: dict, query: str) -> bool:
    if not query:
        return True
    haystack = " ".join(
        [
            str(row.get("bid_at", "")),
            str(row.get("job_title", "")),
            str(row.get("company_name", "")),
            str(row.get("job_description", "")),
            str(row.get("resume_file_name", "")),
        ]
    ).lower()
    return query.lower() in haystack


@app.get("/health")
def health():
    return jsonify(status="ok", libreoffice=find_soffice() is not None)


@app.get("/resume/archives")
def list_archives():
    user_id = resolve_user_id()
    query = (request.args.get("q") or "").strip()
    rows = [
        row
        for row in load_index()
        if row.get("user_id") == user_id and archive_matches_query(row, query)
    ]
    rows.sort(key=lambda r: r.get("bid_at", ""), reverse=True)

    items = [
        {
            "id": row["id"],
            "bidAt": row["bid_at"],
            "jobTitle": row["job_title"],
            "companyName": row["company_name"],
            "jobDescription": row["job_description"],
            "resumeFileName": row["resume_file_name"],
            "pdfFileName": row.get("pdf_file_name"),
        }
        for row in rows
    ]
    return jsonify(items=items)


@app.get("/resume/archives/<archive_id>/docx")
def download_docx(archive_id: str):
    user_id = resolve_user_id()
    row = find_archive(archive_id, user_id)
    if not row:
        return jsonify(error="Saved resume not found."), 404

    docx_path = RESUMES_DIR / row["docx_relative_path"]
    if not docx_path.exists():
        return jsonify(error="DOCX file missing on server."), 404

    return send_file(
        docx_path,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=True,
        download_name=row["resume_file_name"],
    )


@app.get("/resume/archives/<archive_id>/pdf")
def download_pdf(archive_id: str):
    user_id = resolve_user_id()
    row = find_archive(archive_id, user_id)
    if not row:
        return jsonify(error="Saved resume not found."), 404

    pdf_path = RESUMES_DIR / row["pdf_relative_path"]
    if not pdf_path.exists():
        return jsonify(error="PDF file missing on server."), 404

    return send_file(
        pdf_path,
        mimetype="application/pdf",
        as_attachment=False,
        download_name=row.get("pdf_file_name") or pdf_path.name,
    )


@app.post("/resume/archive")
def archive_resume():
    user_id = resolve_user_id()
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
    archive_id = str(uuid.uuid4())
    docx_relative = f"{date_prefix}/{resume_file_name}"
    pdf_relative = f"{date_prefix}/{pdf_file_name}"

    records = load_index()
    records.append(
        {
            "id": archive_id,
            "user_id": user_id,
            "bid_at": dt,
            "job_title": job_title,
            "company_name": company_name,
            "job_description": job_description,
            "resume_file_name": resume_file_name,
            "pdf_file_name": pdf_file_name,
            "docx_relative_path": docx_relative,
            "pdf_relative_path": pdf_relative,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    save_index(records)

    return jsonify(
        id=archive_id,
        resumeName=resume_file_name,
        pdfFileName=pdf_file_name,
        pdfBase64=base64.b64encode(pdf_bytes).decode("ascii"),
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
