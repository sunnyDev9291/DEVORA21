# Saved Resumes — Backend API Spec

The dashboard **Saved resumes** panel lists every application the user saved from Resume Builder, sorted by **bid date** (newest first). Users can search, preview PDF, and download DOCX/PDF.

**Frontend client:** `src/lib/saved-resumes-api.ts`  
**UI:** `src/components/dashboard/SavedResumesPanel.tsx` on `/dashboard`  
**API base:** `https://api.devora21.com` (session cookie auth, `credentials: include`)

---

## Data model (recommended: PostgreSQL)

| Column | Type | Notes |
|--------|------|--------|
| `id` | UUID PK | Returned to frontend |
| `user_id` | UUID FK → User | **Required** — scope all queries to logged-in user |
| `bid_at` | timestamptz | ISO 8601 UTC from `datetime` form field on archive |
| `job_title` | text | Required |
| `company_name` | text | Required |
| `job_description` | text | Optional, may be long |
| `resume_file_name` | text | e.g. `Franco-Acme-Senior-Engineer.docx` |
| `pdf_file_name` | text | e.g. `Franco-Acme-Senior-Engineer.pdf` |
| `docx_storage_key` | text | S3 key or relative path on disk |
| `pdf_storage_key` | text | S3 key or relative path on disk |
| `created_at` | timestamptz | Server insert time |

**Index:** `(user_id, bid_at DESC)` for list queries.

---

## Authentication

All endpoints require the same session cookie used by `/auth/me` and `POST /resume/archive`.

| Status | When |
|--------|------|
| 401 | Not logged in |
| 403 | Logged in but `resumeBuilderEnabled !== true` |

CORS must allow credentials from:

- `https://devora21.com`
- `https://www.devora21.com`
- `https://devora21-dev.netlify.app`
- `http://localhost:3000`

---

## Endpoints

### 1. List saved resumes

```
GET /resume/archives?q={optional search keyword}
```

**Search:** Case-insensitive match across `job_title`, `company_name`, `job_description`, `resume_file_name`, and formatted `bid_at`.

**Sort:** `bid_at` descending (newest bid first).

**Response `200`:**

```json
{
  "items": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "bidAt": "2026-06-20T14:30:00.000Z",
      "jobTitle": "Senior Backend Engineer",
      "companyName": "Acme Corp",
      "jobDescription": "We are looking for...",
      "resumeFileName": "Franco-Acme-Senior-Engineer.docx",
      "pdfFileName": "Franco-Acme-Senior-Engineer.pdf"
    }
  ]
}
```

---

### 2. Download DOCX

```
GET /resume/archives/{id}/docx
```

**Response `200`:**

- `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `Content-Disposition: attachment; filename="..."`
- Body: raw DOCX bytes

---

### 3. Download / preview PDF

```
GET /resume/archives/{id}/pdf
```

Used for preview (inline) and download.

**Response `200`:**

- `Content-Type: application/pdf`
- `Content-Disposition: inline; filename="..."` (or `attachment` for forced download)
- Body: raw PDF bytes

---

### 4. Update existing archive (already implemented)

`POST /resume/archive` must **also** insert a row in the database/index (not only CSV).

On success, optionally return the new archive id:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "resumeName": "Franco-Acme.docx",
  "pdfFileName": "Franco-Acme.pdf",
  "pdfBase64": "..."
}
```

**Form fields (unchanged):**

| Field | Required |
|-------|----------|
| `jobTitle` | yes |
| `companyName` | yes |
| `jobDescription` | no |
| `datetime` | yes (bid time, ISO UTC) |
| `resumeFileName` | yes |
| `resume` | yes (DOCX file) |

Associate the record with `user_id` from the session.

---

## Reference implementation

See `backend/app.py` in this repo:

- `storage/archives_index.json` — dev index (replace with DB in production)
- `storage/resumes/{YYYY}/{MM}/{DD}/` — file storage
- `GET /resume/archives`, `GET /resume/archives/<id>/docx`, `GET /resume/archives/<id>/pdf`

Dev stub resolves user from `X-User-Id` header or defaults to `dev-user`. **Production must use real session auth.**

---

## Frontend flow

1. User applies resume in Resume Builder → `POST /resume/archive` saves DOCX + PDF on backend.
2. User opens **Dashboard → Saved resumes**.
3. Frontend calls `GET /resume/archives` (with optional `?q=`).
4. Click resume name → `GET /resume/archives/{id}/pdf` → PDF preview modal.
5. **DOCX** / **PDF** buttons → download respective endpoints.

---

## Testing checklist

- [ ] Archive creates DB row + files for authenticated user
- [ ] List returns only current user's rows, sorted by `bid_at` DESC
- [ ] Search `q=acme` matches company name, title, description, filename
- [ ] DOCX download returns valid file
- [ ] PDF preview/download returns valid file
- [ ] 404 when id belongs to another user
- [ ] 403 when `resumeBuilderEnabled` is false
- [ ] CORS + cookies work from `devora21.com`

---

## Deploy note

Until these endpoints exist on `api.devora21.com`, the dashboard panel shows an error from the list API. Deploy list + download routes on the production API to activate the feature.
