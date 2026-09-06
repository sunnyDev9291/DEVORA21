"""
Devora21 resume archive API.

POST /resume/archive
  - Saves DOCX, appends CSV row, converts to PDF, returns JSON with pdfBase64.

GET /resume/archives?company=&jobTitle=&jd=&from=&to=
  - Lists saved resumes for the authenticated user (newest bid first).
  - Optional filters combine with AND (case-insensitive substring for company/jobTitle/jd).

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
import io
import json
import os
import shutil
import subprocess
import sys
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

import requests
from flask import Flask, Response, jsonify, request, send_file, stream_with_context
from flask_cors import CORS

APP_DIR = Path(__file__).resolve().parent
STORAGE_DIR = APP_DIR / "storage"
RESUMES_DIR = STORAGE_DIR / "resumes"
CSV_PATH = STORAGE_DIR / "resume_log.csv"
INDEX_PATH = STORAGE_DIR / "archives_index.json"
MAX_FILE_BYTES = 10 * 1024 * 1024
CSV_HEADER = ["datetime", "job_title", "company_name", "job_description", "resume_name"]
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
# Prefer Flash for latency; set DEEPSEEK_MODEL=deepseek-v4-pro for max quality.
DEEPSEEK_MODEL = (os.environ.get("DEEPSEEK_MODEL") or "deepseek-v4-flash").strip() or "deepseek-v4-flash"
AI_REQUEST_TIMEOUT_SECONDS = 300

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
    allow_headers=["Authorization", "Content-Type", "Accept", "X-User-Id"],
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


def validate_docx_bytes(raw: bytes) -> None:
    """Reject uploads that are not a readable DOCX before calling LibreOffice."""
    if not raw.startswith(b"PK"):
        raise ValueError("resume must be a valid .docx file (missing ZIP header).")

    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            bad = archive.testzip()
            if bad:
                raise ValueError(f"resume DOCX is corrupt (bad zip entry: {bad}).")
            document_xml = archive.read("word/document.xml")
    except zipfile.BadZipFile as exc:
        raise ValueError("resume DOCX is not a valid ZIP archive.") from exc

    try:
        ET.fromstring(document_xml)
    except ET.ParseError as exc:
        raise ValueError(f"resume DOCX has invalid document.xml: {exc}") from exc


def convert_docx_to_pdf(docx_path: Path) -> Path:
    soffice = find_soffice()
    if not soffice:
        raise RuntimeError(
            "LibreOffice not found. Install LibreOffice or set LIBREOFFICE_PATH."
        )

    validate_docx_bytes(docx_path.read_bytes())

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
        detail = (result.stderr or result.stdout or "unknown error").strip()
        raise RuntimeError(
            f"LibreOffice could not convert this DOCX to PDF: {detail}"
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


def require_ai_internal_auth() -> bool:
    """When AI_INTERNAL_API_KEY is set, require Bearer token from Next.js / Netlify."""
    expected = os.environ.get("AI_INTERNAL_API_KEY", "").strip()
    if not expected:
        return True
    auth = (request.headers.get("Authorization") or "").strip()
    return auth == f"Bearer {expected}"


def build_deepseek_payload(
    messages: list[dict],
    *,
    max_tokens: int,
    stream: bool,
    json_object: bool,
) -> dict:
    payload: dict = {
        "model": DEEPSEEK_MODEL,
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": stream,
        "temperature": 0.4,
        "thinking": {"type": "disabled"},
    }
    if json_object:
        payload["response_format"] = {"type": "json_object"}
    return payload


def deepseek_headers() -> dict[str, str]:
    api_key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not configured on the backend server.")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }


def parse_ai_request() -> tuple[list[dict] | None, int, bool, tuple[Response, int] | None]:
    if not require_ai_internal_auth():
        return None, 0, False, (jsonify(error="Unauthorized."), 401)

    body = request.get_json(silent=True) or {}
    messages = body.get("messages")
    if not isinstance(messages, list) or not messages:
        return None, 0, False, (jsonify(error="messages is required."), 400)

    normalized: list[dict] = []
    for item in messages:
        if not isinstance(item, dict):
            return None, 0, False, (jsonify(error="Each message must be an object."), 400)
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role not in {"system", "user", "assistant"}:
            return None, 0, False, (jsonify(error="Invalid message role."), 400)
        if not content:
            return None, 0, False, (jsonify(error="Message content cannot be empty."), 400)
        normalized.append({"role": role, "content": content})

    max_tokens = int(body.get("maxTokens") or 4096)
    json_object = bool(body.get("jsonObject"))
    return normalized, max_tokens, json_object, None


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


def parse_bid_at(value: str) -> datetime | None:
    try:
        text = str(value).strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = f"{text[:-1]}+00:00"
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            return parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (ValueError, TypeError):
        return None


def parse_date_bound(value: str, *, end_of_day: bool = False) -> datetime | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.strptime(text, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        if end_of_day:
            return parsed.replace(hour=23, minute=59, second=59, microsecond=999999)
        return parsed
    except ValueError:
        return None


def archive_matches_filters(
    row: dict,
    *,
    company: str = "",
    job_title: str = "",
    jd: str = "",
    date_from: str = "",
    date_to: str = "",
) -> bool:
    if company and company.lower() not in str(row.get("company_name", "")).lower():
        return False
    if job_title and job_title.lower() not in str(row.get("job_title", "")).lower():
        return False
    if jd and jd.lower() not in str(row.get("job_description", "")).lower():
        return False

    if date_from or date_to:
        bid_at = parse_bid_at(str(row.get("bid_at", "")))
        if not bid_at:
            return False
        start = parse_date_bound(date_from)
        end = parse_date_bound(date_to, end_of_day=True)
        if start and bid_at < start:
            return False
        if end and bid_at > end:
            return False

    return True


@app.get("/health")
def health():
    return jsonify(
        status="ok",
        libreoffice=find_soffice() is not None,
        deepseek=bool(os.environ.get("DEEPSEEK_API_KEY", "").strip()),
    )


@app.post("/ai/chat/completions")
def ai_chat_completions():
    messages, max_tokens, json_object, error_response = parse_ai_request()
    if error_response is not None:
        return error_response

    try:
        upstream = requests.post(
            DEEPSEEK_API_URL,
            headers=deepseek_headers(),
            json=build_deepseek_payload(
                messages,
                max_tokens=max_tokens,
                stream=False,
                json_object=json_object,
            ),
            timeout=AI_REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        return jsonify(error=f"Failed to reach DeepSeek: {exc}"), 502

    if not upstream.ok:
        detail = upstream.text.strip() or upstream.reason
        return jsonify(error=f"DeepSeek API error ({upstream.status_code}): {detail}"), upstream.status_code

    data = upstream.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
        .strip()
    )
    if not content:
        return jsonify(error="Empty response from DeepSeek."), 502

    return jsonify(content=content, model=DEEPSEEK_MODEL)


@app.post("/ai/chat/completions/stream")
def ai_chat_completions_stream():
    messages, max_tokens, json_object, error_response = parse_ai_request()
    if error_response is not None:
        return error_response

    try:
        headers = deepseek_headers()
    except RuntimeError as exc:
        return jsonify(error=str(exc)), 500

    payload = build_deepseek_payload(
        messages,
        max_tokens=max_tokens,
        stream=True,
        json_object=json_object,
    )

    def generate():
        try:
            with requests.post(
                DEEPSEEK_API_URL,
                headers=headers,
                json=payload,
                stream=True,
                timeout=AI_REQUEST_TIMEOUT_SECONDS,
            ) as upstream:
                if not upstream.ok:
                    detail = upstream.text.strip() or upstream.reason
                    yield f"data: {json.dumps({'error': f'DeepSeek API error ({upstream.status_code}): {detail}'})}\n\n"
                    return

                for line in upstream.iter_lines(decode_unicode=True):
                    if line is None:
                        continue
                    text = line.strip()
                    if not text:
                        continue
                    if text.startswith("data:"):
                        yield f"{text}\n\n"
                    else:
                        yield f"data: {text}\n\n"
        except requests.RequestException as exc:
            yield f"data: {json.dumps({'error': f'Failed to reach DeepSeek: {exc}'})}\n\n"

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-store",
            "Connection": "keep-alive",
        },
    )


@app.get("/resume/archives")
def list_archives():
    user_id = resolve_user_id()
    legacy_query = (request.args.get("q") or "").strip()
    company = (request.args.get("company") or "").strip()
    job_title = (request.args.get("jobTitle") or request.args.get("title") or "").strip()
    jd = (request.args.get("jd") or "").strip()
    date_from = (request.args.get("from") or "").strip()
    date_to = (request.args.get("to") or "").strip()

    rows = []
    for row in load_index():
        if row.get("user_id") != user_id:
            continue
        if legacy_query and not archive_matches_query(row, legacy_query):
            continue
        if not archive_matches_filters(
            row,
            company=company,
            job_title=job_title,
            jd=jd,
            date_from=date_from,
            date_to=date_to,
        ):
            continue
        rows.append(row)
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

    try:
        validate_docx_bytes(raw)
    except ValueError as exc:
        return jsonify(error=str(exc)), 422

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
