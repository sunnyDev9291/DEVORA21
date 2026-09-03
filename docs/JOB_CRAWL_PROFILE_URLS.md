# Job crawl listing URLs on user profile

Each user stores their own crawl listing URLs (Built In, HiringCafe, Workable, Working Nomads).

## Frontend behavior

- **Dashboard → Job crawl listing URLs:** edit and save defaults per account
- **Job discovery (`/resume/discover`):** loads URLs from the signed-in profile (falls back to app defaults)
- Local fallback: `devora21-user-profile:{userId}.listingUrls` when the API is unavailable

## Backend contract

### `GET /auth/me`

Optional field on the user object:

```json
{
  "listingUrls": {
    "builtin": "https://builtin.com/jobs/…",
    "hiringcafe": "https://hiringcafe.com/?searchState=…",
    "workable": "https://jobs.workable.com/search?…",
    "workingnomads": "https://www.workingnomads.com/jobs?…"
  }
}
```

Alias accepted: `listing_urls`.

### `PATCH /auth/profile` (multipart)

Append either:

1. `listingUrls` — JSON string of the object above, and/or
2. Flat fields: `listingUrl_builtin`, `listingUrl_hiringcafe`, `listingUrl_workable`, `listingUrl_workingnomads`

Empty / omitted platforms keep the previous stored value or fall back to app defaults on the client.

## Platform keys

| Key | Label |
|-----|--------|
| `builtin` | Built In |
| `hiringcafe` | HiringCafe |
| `workable` | Workable |
| `workingnomads` | Working Nomads |
