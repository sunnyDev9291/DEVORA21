# Resume Archive & PDF Export — Backend Implementation Prompt

Use this document to implement the backend endpoint that the Devora21 Next.js frontend calls after a user finalizes their tailored resume.

**Frontend proxy:** `POST /api/resume/archive` (Next.js)  
**Backend target:** `POST {API_BASE_URL}/resume/archive`  
**Default API base:** `http://31.44.7.64:5000`

---

## Goal

When a user applies their AI-edited resume to a DOCX template, the frontend automatically:

1. Sends job metadata + the generated `.docx` file to the backend
2. Backend appends a row to a CSV log
3. Backend saves the `.docx` file to disk
4. Backend converts DOCX → PDF
5. Backend returns the PDF to the frontend for download

---

## Request

### Endpoint

```
POST /resume/archive
Content-Type: multipart/form-data
```

### Form fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `jobTitle` | string | yes | Target role title |
| `companyName` | string | yes | Target company |
| `jobDescription` | string | no | Full job posting text (may be empty) |
| `datetime` | string | yes | ISO 8601 UTC timestamp from frontend, e.g. `2026-06-15T20:30:00.000Z` |
| `resume` | file | yes | Generated `.docx` file |

### Example (curl)

```bash
curl -X POST "http://31.44.7.64:5000/resume/archive" \
  -F "jobTitle=Senior Backend Engineer" \
  -F "companyName=Acme Corp" \
  -F "jobDescription=We are looking for..." \
  -F "datetime=2026-06-15T20:30:00.000Z" \
  -F "resume=@Franco-tailored.docx"
```

---

## Backend responsibilities

### 1. Validate input

- Reject if `jobTitle` or `companyName` is missing
- Reject if `resume` is missing or not a `.docx` file
- Reject if file size exceeds a sensible limit (e.g. 10 MB)

### 2. Save DOCX file

Store under a structured path, for example:

```
storage/resumes/{YYYY}/{MM}/{DD}/{sanitized-company}_{sanitized-title}_{timestamp}.docx
```

Use the original filename from the upload when safe, or generate a unique name.

### 3. Append CSV row

CSV file path example: `storage/resume_log.csv`

**Columns (header row):**

```csv
datetime,job_title,company_name,job_description,resume_name
```

**Row example:**

```csv
2026-06-15T20:30:00.000Z,Senior Backend Engineer,Acme Corp,"We are looking for...",Franco-tailored.docx
```

Rules:
- Escape commas/quotes in `job_description` per RFC 4180
- `resume_name` = saved DOCX filename (not full path)
- Create CSV with header if it does not exist
- Append one row per request

### 4. Convert DOCX to PDF

Use one of:
- **LibreOffice headless:** `soffice --headless --convert-to pdf --outdir {dir} {docx}`
- **unoconv**
- **Cloud conversion API** (if on serverless)

Save PDF alongside DOCX or in a `pdfs/` subfolder.

### 5. Return PDF to frontend

Support **either** response format (frontend proxy handles both):

#### Option A — JSON (recommended)

```json
{
  "resumeName": "Franco-tailored.docx",
  "pdfFileName": "Franco-tailored.pdf",
  "pdfBase64": "<base64-encoded-pdf>"
}
```

Status: `200 OK`  
Content-Type: `application/json`

#### Option B — Raw PDF

Status: `200 OK`  
Content-Type: `application/pdf`  
Headers:
- `Content-Disposition: attachment; filename="Franco-tailored.pdf"`
- `X-Resume-Name: Franco-tailored.docx` (optional)
- `X-Pdf-Filename: Franco-tailored.pdf` (optional)

Body: raw PDF bytes

### Error responses

```json
{
  "error": "Human-readable message"
}
```

| Status | When |
|--------|------|
| 400 | Missing/invalid fields |
| 413 | File too large |
| 422 | DOCX invalid or PDF conversion failed |
| 500 | Internal server error |

---

## Suggested Python (Flask) skeleton

```python
import csv
import base64
import subprocess
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify

app = Flask(__name__)
STORAGE = Path("storage")
RESUMES_DIR = STORAGE / "resumes"
CSV_PATH = STORAGE / "resume_log.csv"

@app.post("/resume/archive")
def archive_resume():
    job_title = request.form.get("jobTitle", "").strip()
    company_name = request.form.get("companyName", "").strip()
    job_description = request.form.get("jobDescription", "").strip()
    dt = request.form.get("datetime", datetime.utcnow().isoformat() + "Z")
    file = request.files.get("resume")

    if not job_title or not company_name:
        return jsonify(error="jobTitle and companyName are required"), 400
    if not file or not file.filename.lower().endswith(".docx"):
        return jsonify(error="resume DOCX file is required"), 400

    RESUMES_DIR.mkdir(parents=True, exist_ok=True)
    safe_name = secure_filename(file.filename)  # from werkzeug
    docx_path = RESUMES_DIR / safe_name
    file.save(docx_path)

    # Append CSV
    write_header = not CSV_PATH.exists()
    with CSV_PATH.open("a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["datetime", "job_title", "company_name", "job_description", "resume_name"])
        writer.writerow([dt, job_title, company_name, job_description, safe_name])

    # Convert to PDF
    pdf_path = docx_path.with_suffix(".pdf")
    subprocess.run(
        ["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(docx_path.parent), str(docx_path)],
        check=True,
        timeout=120,
    )

    pdf_bytes = pdf_path.read_bytes()
    return jsonify(
        resumeName=safe_name,
        pdfFileName=pdf_path.name,
        pdfBase64=base64.b64encode(pdf_bytes).decode("ascii"),
    )
```

Install on server: `libreoffice` or `libreoffice-writer` for headless conversion.

---

## CORS (if frontend calls backend directly later)

```
Access-Control-Allow-Origin: https://devora21-dev.netlify.app
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Currently the Next.js app proxies via `/api/resume/archive`, so CORS is not required for the browser → backend hop.

---

## Frontend flow (already implemented)

1. User clicks **Apply to resume** → `POST /api/resume/build` → receives `docxBase64`
2. Frontend immediately calls `POST /api/resume/archive` with FormData
3. On success → **Download PDF** button enabled
4. On failure → DOCX still downloadable; **Retry PDF** shown

### Frontend files

- `src/lib/resume-archive.ts` — client
- `src/app/api/resume/archive/route.ts` — Next.js proxy to backend
- `src/components/sections/ResumeGenerator.tsx` — UI + download buttons

---

## Testing checklist

- [ ] Valid DOCX upload returns PDF JSON with non-empty `pdfBase64`
- [ ] CSV row appended with correct columns
- [ ] DOCX saved to disk with correct filename
- [ ] PDF opens correctly after download from frontend
- [ ] Missing `jobTitle` → 400
- [ ] Invalid file type → 400
- [ ] LibreOffice/converter installed on server
- [ ] Large job descriptions escaped correctly in CSV

---

## Environment

Backend should run at the URL configured in frontend:

```
NEXT_PUBLIC_API_BASE_URL=http://31.44.7.64:5000
```

No authentication required initially (add later when auth is implemented).
