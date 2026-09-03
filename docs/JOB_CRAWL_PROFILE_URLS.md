# Job crawl listing URLs — backend contract

## Product rule
- Users edit crawl listing URLs only on the **profile dashboard**
- Clicking **Save profile** must persist `listingUrls` on the backend for that user
- Job discovery reads those URLs; it does **not** offer URL edit inputs

## Platform keys (exact)
builtin | hiringcafe | workable | workingnomads

## Shape
```json
{
  "listingUrls": {
    "builtin": "https://builtin.com/jobs/...",
    "hiringcafe": "https://hiringcafe.com/?searchState=...",
    "workable": "https://jobs.workable.com/search?...",
    "workingnomads": "https://www.workingnomads.com/jobs?..."
  }
}
```

## Required API behavior

### GET /auth/me
Return `listingUrls` on the user object (alias `listing_urls` accepted on parse).

### PATCH /auth/profile
Support **both**:

1. **multipart/form-data** (existing profile save):
   - field `listingUrls` = JSON string of the object above
   - optional flat fields: `listingUrl_builtin`, `listingUrl_hiringcafe`, `listingUrl_workable`, `listingUrl_workingnomads`

2. **application/json**:
```json
{
  "firstName": "...",
  "lastName": "...",
  "customPrompt": "...",
  "listingUrls": {
    "builtin": "...",
    "hiringcafe": "...",
    "workable": "...",
    "workingnomads": "..."
  }
}
```

### Persist rules
- Authenticated user only (401 if not)
- Merge by platform: provided non-empty URL overwrites that platform
- Omitted platforms keep previous values
- Persist on the user record; return updated user including `listingUrls`
- Do not wipe listingUrls when the request has no listingUrls field
- Do not break existing avatar / resumeTemplate / promptFile / name fields

### Acceptance
1. Dashboard Save profile with listingUrls → stored in DB
2. GET /auth/me returns those URLs for that user only
3. Another user cannot see them
4. Job discovery can crawl using the saved URLs
