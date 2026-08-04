# AI Chat Completions — Backend Implementation Prompt

Use this document to implement the backend endpoints that the Devora21 Next.js app calls for all AI work (resume generation, chat, scoring helpers, template AI parse).

**Frontend / Netlify callers:** Next.js API routes and Netlify background functions  
**Backend target:** `https://api.devora21.com`  
**Default API base:** `https://api.devora21.com`

---

## Goal

Move all DeepSeek API calls off Netlify and into the separate backend server.

The Next.js app still:
- builds prompts
- parses templates
- post-processes AI JSON
- builds DOCX files

The backend server only:
- stores `DEEPSEEK_API_KEY`
- proxies chat completion requests to DeepSeek
- returns text or a stream

---

## Environment variables (backend server)

| Variable | Required | Description |
|----------|----------|-------------|
| `DEEPSEEK_API_KEY` | yes | DeepSeek API key. Never expose to the browser or Netlify. |
| `DEEPSEEK_MODEL` | no | Defaults to `deepseek-v4-flash` (fast). Set `deepseek-v4-pro` for max quality. |
| `AI_INTERNAL_API_KEY` | recommended | Shared secret. Next.js / Netlify send `Authorization: Bearer <key>`. If unset, endpoints are open (dev only). |

## Environment variables (Netlify / Next.js)

| Variable | Required | Description |
|----------|----------|-------------|
| `BACKEND_API_URL` | yes | `https://api.devora21.com` |
| `AI_INTERNAL_API_KEY` | recommended | Same value as backend `AI_INTERNAL_API_KEY` (server-only; prepare returns it at runtime for browser streaming) |

Remove `DEEPSEEK_API_KEY` from Netlify after deploy.

---

## Endpoint 1 — Non-streaming completion

### Request

```
POST /ai/chat/completions
Authorization: Bearer <AI_INTERNAL_API_KEY>
Content-Type: application/json
```

### JSON body

```json
{
  "messages": [
    { "role": "system", "content": "You are a resume writer..." },
    { "role": "user", "content": "Generate resume content for..." }
  ],
  "maxTokens": 16384,
  "jsonObject": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | yes | OpenAI-style chat messages |
| `maxTokens` | number | no | Default `4096` |
| `jsonObject` | boolean | no | When `true`, send DeepSeek `response_format: { type: "json_object" }` |

Allowed roles: `system`, `user`, `assistant`

### Success response

```json
{
  "content": "{ \"title\": \"...\", \"summary\": \"...\" }",
  "model": "deepseek-v4-flash"
}
```

### Error response

```json
{
  "error": "Human-readable error message"
}
```

### Backend behavior

1. Validate `Authorization` when `AI_INTERNAL_API_KEY` is set
2. Validate `messages`
3. Call DeepSeek:

```
POST https://api.deepseek.com/chat/completions
Authorization: Bearer <DEEPSEEK_API_KEY>
Content-Type: application/json

{
  "model": "deepseek-v4-flash",
  "messages": [...],
  "max_tokens": 16384,
  "stream": false,
  "temperature": 0.4,
  "thinking": { "type": "disabled" },
  "response_format": { "type": "json_object" }
}
```

4. Return `choices[0].message.content`

### Example curl

```bash
curl -X POST "https://api.devora21.com/ai/chat/completions" \
  -H "Authorization: Bearer YOUR_INTERNAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"system","content":"Reply with one short sentence."},
      {"role":"user","content":"Say hello."}
    ],
    "maxTokens": 256,
    "jsonObject": false
  }'
```

---

## Endpoint 2 — Streaming completion

### Request

```
POST /ai/chat/completions/stream
Authorization: Bearer <AI_INTERNAL_API_KEY>
Content-Type: application/json
```

Same JSON body as the non-streaming endpoint.

### Success response

```
Content-Type: text/plain; charset=utf-8
X-Model: claude-sonnet-4-6

{streaming plain text chunks — not SSE, not a JSON envelope}
```

Resume generation in the browser appends raw text as it arrives, then JSON-parses when `jsonObject` was true.

### Backend behavior

1. Same auth and validation as non-streaming
2. Call Claude with `"stream": true`
3. Pipe plain-text token chunks to the caller (no OpenAI SSE wrappers)
4. Use a long timeout (recommended: 300 seconds)

---

## Callers in the Next.js app

These modules call the backend AI endpoints:

- `src/lib/browser-ai-stream.ts` — browser-direct resume stream (plain text)
- `src/lib/ai-backend-client.ts` — server utility calls
- `src/lib/deepseek-stream.ts` — thin wrapper around ai-backend-client
- `netlify/functions/resume-generate-background.ts` — legacy (resume gen no longer uses this)

Used for:
- resume generation (browser → `/ai/chat/completions/stream`)
- resume chat
- general chat
- ATS keyword extraction
- rule-keep scoring
- DOCX template AI parse fallback

---

## CORS

Resume generation streams from the browser to `api.devora21.com`, so CORS must allow:

- Origins: app domains (`devora21.com`, Netlify preview, localhost)
- Headers: `Authorization`, `Content-Type`, `Accept`
- Methods: `POST`, `OPTIONS`

The browser sends `userId` in the JSON body (not `X-User-Id`) to stay within common Allow-Headers lists.
If CORS still blocks the browser, the app falls back to a same-origin Netlify BFF proxy.

---

## Health check

Extend existing health endpoint:

```
GET /health
```

Example:

```json
{
  "status": "ok",
  "libreoffice": true,
  "deepseek": true
}
```

`deepseek: true` means `DEEPSEEK_API_KEY` is configured.

---

## Reference implementation

See `backend/app.py` in this repo:
- `POST /ai/chat/completions`
- `POST /ai/chat/completions/stream`

Install deps:

```bash
cd backend
pip install -r requirements.txt
```

Run locally:

```bash
export DEEPSEEK_API_KEY=your_key
export AI_INTERNAL_API_KEY=your_internal_key
python app.py
```

---

## Deployment checklist

1. Add `DEEPSEEK_API_KEY` to `api.devora21.com`
2. Add `AI_INTERNAL_API_KEY` to `api.devora21.com`
3. Deploy backend with the new routes
4. Add `AI_INTERNAL_API_KEY` to Netlify (same value)
5. Ensure `BACKEND_API_URL=https://api.devora21.com` on Netlify
6. Remove `DEEPSEEK_API_KEY` from Netlify
7. Test resume generation and chat in production

---

## Security notes

- Never expose `DEEPSEEK_API_KEY` to the frontend
- Require `AI_INTERNAL_API_KEY` in production
- Optionally rate-limit `/ai/chat/completions*`
- Log request duration and token usage for monitoring
