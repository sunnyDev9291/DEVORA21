# Authentication — Implementation Context

> **Status:** Frontend UI is scaffolded in the Next.js app. **Backend integration is pending.**  
> Auth will be completed later when the API at `http://31.44.7.64:5000` is ready.

**Last updated:** 2026-06-15  
**Frontend (production):** https://devora21-dev.netlify.app  
**Backend API (expected):** http://31.44.7.64:5000

---

## Architecture decisions

| Decision | Choice |
|----------|--------|
| Session storage | **HTTP-only cookies** set by backend |
| JWT in localStorage | **Not used** — do not add |
| API client | Axios with `withCredentials: true` |
| OAuth | Browser redirect to backend (`/auth/google`, `/auth/microsoft`) |
| Frontend framework | Next.js App Router (integrated into main site) |

A standalone Vite auth app (`frontend/`) was created early in development and **removed** to fix Netlify builds. All auth lives in `src/` below.

---

## Environment variables

### Local (`.env.local`)

```env
NEXT_PUBLIC_API_BASE_URL=http://31.44.7.64:5000
```

### Netlify

Set the same variable in Site settings → Environment variables:

```
NEXT_PUBLIC_API_BASE_URL=http://31.44.7.64:5000
```

See also `.env.example` at repo root.

---

## Frontend routes (Next.js)

| Route | Page file | Access |
|-------|-----------|--------|
| `/login` | `src/app/login/page.tsx` | Guest only |
| `/register` | `src/app/register/page.tsx` | Guest only |
| `/forgot-password` | `src/app/forgot-password/page.tsx` | Guest only |
| `/reset-password?token=…` | `src/app/reset-password/page.tsx` | Public |
| `/verify-email?token=…` | `src/app/verify-email/page.tsx` | Public |
| `/dashboard` | `src/app/dashboard/page.tsx` | Protected |

**Redirects:**
- After login/register success → `/dashboard`
- Unauthenticated user on protected route → `/login`
- Authenticated user on guest routes → `/dashboard`

Route constants: `AUTH_LINKS` in `src/lib/constants.ts`.

---

## Navbar integration

`src/components/layout/NavbarActions.tsx`:
- **Signed out:** Sign in, Sign up
- **Signed in:** Dashboard, Sign out

Wrapped by `AuthProvider` in `src/app/layout.tsx`.

---

## Key frontend files

```
src/
├── app/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   ├── reset-password/page.tsx
│   ├── verify-email/page.tsx
│   └── dashboard/page.tsx
├── components/auth/
│   ├── AuthGuard.tsx      # GuestGuard + AuthGuard
│   ├── AuthLayout.tsx
│   ├── AuthInput.tsx
│   └── OAuthButtons.tsx
├── context/
│   └── AuthContext.tsx    # AuthProvider, useAuth()
├── lib/
│   ├── auth-api.ts        # Axios client + authApi
│   └── auth-schemas.ts    # Zod validation
└── types/
    └── auth.ts            # User, AuthResponse, etc.
```

---

## Backend API contract (expected)

Base URL: `NEXT_PUBLIC_API_BASE_URL` (no trailing slash)

### Session check

```
GET /auth/me
```

**Response 200:** current user object  
**Response 401:** not authenticated

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Jane Doe",
  "emailVerified": true,
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Email / password

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/auth/login` | `{ "email", "password" }` |
| POST | `/auth/register` | `{ "name", "email", "password" }` |
| POST | `/auth/logout` | — |
| POST | `/auth/forgot-password` | `{ "email" }` |
| POST | `/auth/reset-password` | `{ "token", "password" }` |
| POST | `/auth/verify-email` | `{ "token" }` |

**Login/register success:** set session cookie + return:

```json
{
  "user": { "id", "email", "name", "emailVerified" },
  "message": "optional"
}
```

**Errors:** `{ "message": "..." }` or `{ "message", "errors": { "field": ["..."] } }`

### OAuth

Full-page redirect (no XHR):

```
GET {API_BASE_URL}/auth/google
GET {API_BASE_URL}/auth/microsoft
```

After OAuth, backend should:
1. Set HTTP-only session cookie
2. Redirect to frontend `/dashboard` (or `/login` on failure)

---

## CORS & cookies (backend requirements)

Because frontend and API are on different origins:

1. **Allow origins:**
   - `https://devora21-dev.netlify.app`
   - `http://localhost:3000` (local dev)

2. **Headers:**
   - `Access-Control-Allow-Credentials: true`
   - `Access-Control-Allow-Origin` = exact frontend origin (not `*` when using cookies)

3. **Cookies (production):**
   - `HttpOnly`
   - `Secure`
   - `SameSite=None` (cross-origin)

4. **Preflight:** Allow `OPTIONS` for auth routes with credentials.

---

## Security checklist (when going live)

- [ ] Backend implements all `/auth/*` routes above
- [ ] CORS configured for Netlify + localhost
- [ ] Cookies are HttpOnly; no JWT in localStorage
- [ ] OAuth redirect URLs registered with Google/Microsoft
- [ ] `NEXT_PUBLIC_API_BASE_URL` set on Netlify
- [ ] Email verification + reset-password emails working
- [ ] Rate limiting on login/register/forgot-password
- [ ] HTTPS on both frontend and API in production

---

## Current behavior without backend

- Auth **pages and navbar links render** correctly
- `GET /auth/me` failure → treated as logged out (no crash)
- Login, register, OAuth, logout **fail** until backend is live and CORS/cookies are configured

---

## TODO when implementing backend

1. Deploy auth API at `31.44.7.64:5000` (or update env URL)
2. Implement endpoints matching this contract
3. Configure CORS + cookie settings
4. Test locally: login → `/dashboard` → refresh → still logged in
5. Test OAuth redirects end-to-end on Netlify preview
6. Optionally protect resume builder routes (currently public)
7. Remove or gate dashboard placeholder content

---

## Related packages (already in `package.json`)

- `axios`
- `react-hook-form`
- `@hookform/resolvers`
- `zod`

No additional frontend auth packages required unless you add social login SDKs (not needed with redirect-based OAuth).
