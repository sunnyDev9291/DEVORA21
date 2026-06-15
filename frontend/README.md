# Devora21 Auth Frontend

Cookie-based authentication UI for Devora21, built with React, Vite, TypeScript, and Tailwind CSS.

**Live frontend:** https://devora21-dev.netlify.app  
**Backend API:** http://31.44.7.64:5000

## Features

- Email/password login and registration
- Google and Microsoft OAuth sign-in
- Forgot password and reset password flows
- Email verification
- Protected dashboard route
- HTTP-only cookie sessions (no JWT in `localStorage`)
- All API requests sent with credentials (`withCredentials: true`)

## Tech stack

- React 19 + Vite 6
- TypeScript
- Tailwind CSS
- React Hook Form + Zod
- Axios
- React Router

## Getting started

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Configure environment

Copy the example env file and adjust if needed:

```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://31.44.7.64:5000
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:5173

### 4. Build for production

```bash
npm run build
npm run preview
```

Output is written to `dist/`.

## Routes

| Route | Description | Auth |
|-------|-------------|------|
| `/login` | Sign in | Guest only |
| `/register` | Create account | Guest only |
| `/forgot-password` | Request reset email | Guest only |
| `/reset-password?token=…` | Set new password | Public |
| `/verify-email?token=…` | Confirm email | Public |
| `/dashboard` | User dashboard | Protected |

Unauthenticated users accessing `/dashboard` are redirected to `/login`.  
Authenticated users visiting guest routes are redirected to `/dashboard`.

## API endpoints

The client expects these backend routes (all under `VITE_API_BASE_URL`):

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/auth/me` | Current user (session check) |
| `POST` | `/auth/login` | `{ email, password }` |
| `POST` | `/auth/register` | `{ name, email, password }` |
| `POST` | `/auth/logout` | End session |
| `POST` | `/auth/forgot-password` | `{ email }` |
| `POST` | `/auth/reset-password` | `{ token, password }` |
| `POST` | `/auth/verify-email` | `{ token }` |
| `GET` | `/auth/google` | Google OAuth redirect |
| `GET` | `/auth/microsoft` | Microsoft OAuth redirect |

### OAuth

OAuth buttons redirect the browser to the backend:

```ts
window.location.href = `${VITE_API_BASE_URL}/auth/google`;
window.location.href = `${VITE_API_BASE_URL}/auth/microsoft`;
```

After OAuth completes, the backend should set the session cookie and redirect the user back to the frontend (typically `/dashboard`).

## Security

- **No JWT in localStorage** — authentication relies on HTTP-only cookies set by the backend.
- **Credentials on every request** — the Axios client is configured with `withCredentials: true`.
- **Protected routes** — `ProtectedRoute` checks `/auth/me` before rendering the dashboard.

## CORS (backend requirement)

Because the frontend and API run on different origins, the backend must:

1. Allow the frontend origin (e.g. `https://devora21-dev.netlify.app`, `http://localhost:5173`)
2. Set `Access-Control-Allow-Credentials: true`
3. Use `SameSite=None; Secure` for cookies in production (HTTPS)

## Deploy to Netlify

1. Set **Base directory** to `frontend`
2. **Build command:** `npm run build`
3. **Publish directory:** `frontend/dist`
4. Add environment variable: `VITE_API_BASE_URL=http://31.44.7.64:5000`
5. Include `public/_redirects` for SPA routing (already provided)

## Project structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/       # AuthLayout, OAuthButtons, ProtectedRoute
│   │   └── ui/         # Button, Input
│   ├── context/        # AuthProvider
│   ├── lib/            # Axios API client
│   ├── pages/          # Route pages
│   ├── schemas/        # Zod validation
│   └── types/          # TypeScript types
├── .env.example
└── README.md
```

## License

Private — Devora21
