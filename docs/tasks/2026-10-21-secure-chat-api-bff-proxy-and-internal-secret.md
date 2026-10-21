# Task Archive: Secure Chat API with BFF Next.js Proxy & Internal Secret Token

- **Date**: 2026-10-21
- **Status**: COMPLETED (QA PASS)
- **Session Mode**: fresh

---

### 1. Goal & Context
Protect the FastAPI backend (`fooday_backend`) on Render from unauthorized direct calls, scrapers, and curl spam, and hide the Render backend URL completely from the browser DevTools by creating Next.js Server-Side Route Handlers (BFF Proxy) in `fooday_frontend` with an internal shared secret header (`x-internal-secret`).

---

### 2. Implementation Summary

#### Backend (`fooday_backend`)
- In `fooday_backend/app/config.py`: Added `INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET")`.
- In `fooday_backend/app/api.py`: Added `verify_internal_secret` FastAPI dependency checking header `x-internal-secret`.
  - When `INTERNAL_API_SECRET` is set: calls without the matching secret receive `403 Forbidden`.
  - When `INTERNAL_API_SECRET` is unset: allows requests (graceful development fallback).
  - Applied dependency globally to `router = APIRouter(dependencies=[Depends(verify_internal_secret)])`.
- In `fooday_backend/.env.example`: Documented `INTERNAL_API_SECRET`.

#### Frontend (`fooday_frontend`)
- Created `fooday_frontend/src/app/api/chat/route.ts`:
  - Next.js Route Handler (`POST`) forwarding chat requests to backend (`/chat`) with `x-internal-secret`.
  - Automatically resolves backend URL from `BACKEND_INTERNAL_URL` or `NEXT_PUBLIC_API_URL` or default `http://127.0.0.1:2001/api/v1`.
- Created `fooday_frontend/src/app/api/dish-image/route.ts`:
  - Next.js Route Handler (`GET`) forwarding Unsplash proxy search queries with `x-internal-secret`.
- Updated `fooday_frontend/src/services/api.ts`:
  - Added `resolveEndpoint(path)`: defaults to relative `/api/chat` and `/api/dish-image` on the same host, keeping the backend domain completely hidden from client DevTools.
- In `fooday_frontend/.env.example`: Documented `BACKEND_INTERNAL_URL` and `INTERNAL_API_SECRET`.

---

### 3. Verification & QA Results
- **Frontend Lint**: `npm --prefix fooday_frontend run lint` -> **PASS** (0 errors)
- **Frontend Typecheck**: `tsc --noEmit` -> **PASS** (0 errors)
- **Backend Compile**: `python -m compileall -q fooday_backend/app` -> **PASS** (0 errors)
