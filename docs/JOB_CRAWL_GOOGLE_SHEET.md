# Job crawl → Google Sheet (“Add Sheet”)

When you check jobs in the Job Crawl dashboard and click **Add Sheet**, the app appends rows to the matching country tab in your Google Spreadsheet.

## Columns written (in order)

| Column | Header | Value |
|--------|--------|--------|
| A | `No` | Next integer after the highest existing `No` on that tab |
| B | `Date` | Today in US Eastern, e.g. `2026/9/24` |
| C | `Day_Count` | Count of rows already dated today on that tab + 1, 2, … |
| D | `Country` | Selected country (same as tab name) |
| E | `Job_Platform` | Platform label (`Built In`, `HiringCafe`, …) |
| F | `Job_URL` | Full job URL |

Duplicate URLs already on that tab are skipped.

## Sheet tabs (names must match exactly)

- `Brazil`
- `Argentina`
- `Colombia`
- `Dominican Republic`
- `Other`

Row 1 should be the header row above. Data starts on row 2.

## Google Cloud / Sheet setup

1. Open [Google Cloud Console](https://console.cloud.google.com/) → create or pick a project.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
4. Open the service account → **Keys → Add key → Create new key → JSON**. Download the JSON.
5. Open your Google Sheet → **Share** → add the service account email (`client_email` from the JSON) as **Editor**.
6. Copy the spreadsheet ID from the URL:  
   `https://docs.google.com/spreadsheets/d/`**`SPREADSHEET_ID`**`/edit`

## Environment variables (Netlify / local `.env`)

Set on the Next.js host (Netlify site env), **not** as `NEXT_PUBLIC_*`:

```bash
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id

# Option A — paste the whole service-account JSON as one line
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"...@....iam.gserviceaccount.com",...}

# Option B — split fields
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

On Netlify, after saving env vars, trigger a new deploy so the API route can read them.

## Sheet protection (common “protected cell” error)

Allowing the service account on **one range** is not always enough.

1. Open **Data → Protect sheets and ranges**.
2. Check **every** item for that country tab:
   - **Protect sheet** (whole tab) — add the service account as an editor, or delete this rule.
   - **Protect range** — must cover the rows you write into, typically **`A2:F`** (or `A2:F5000`), and include the service account.
3. Best setup: protect **only row 1** (headers). Leave all data rows editable.
4. Confirm Netlify `GOOGLE_SERVICE_ACCOUNT_JSON` → `client_email` is **exactly** the same email you checked in the permission dialog (e.g. `franco@….iam.gserviceaccount.com`).
5. The sheet must also be **Shared** with that service account as **Editor**.

The app writes columns **A–F** on the next empty rows (it does not only touch column F).
