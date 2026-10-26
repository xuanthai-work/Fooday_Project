# Fooday 🍱

**Fooday** is a premium, AI-powered food discovery application designed to answer the eternal question: *"What should I eat today?"*

This project is built with a modern, fully-responsive Next.js frontend and a lightweight FastAPI Python backend. It features a polished, mobile-first UI with glassmorphism, fluid typography, seamless Supabase authentication, and a dedicated AI chat interface.

## 🏗️ Architecture

The project is split into two primary workspaces:

### 1. Frontend (`/fooday_frontend`)
A sleek, high-performance web application.
- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Zero-dependency, purely native `styled-jsx` using a robust CSS variable system (`globals.css`). No Tailwind or external UI libraries.
- **Authentication:** Supabase Auth (Email/Password & Anonymous Guest mode).
- **Icons:** `lucide-react`.
- **Responsive Design:** Fluid `.app-shell` architecture. Operates as a native-feeling app on mobile, and adapts to a premium card-based layout with a sidebar on desktop.

### 2. Backend (`/fooday_backend`)
A lightweight AI service layer.
- **Framework:** FastAPI (Python)
- **API:** RESTful `/api/v1/chat` endpoint designed to handle AI model inference and return grounded food recommendations based on the user's queries and favorites.
- **Database:** Supabase via `supabase-py` over HTTPS (no direct Postgres sockets required, ensuring compatibility with Supabase's free tier).

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- A **Supabase** account (Free tier is perfectly fine)

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd fooday_frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables:
   Copy `.env.example` to `.env.local` and fill in the two required Supabase values:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   `BACKEND_INTERNAL_URL` / `NEXT_PUBLIC_API_URL` are optional locally — they
   default to `http://127.0.0.1:2001/api/v1`.
4. Start the development server:
   ```bash
   npm run dev
   ```

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd fooday_backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate      # Windows (PowerShell / CMD)
   source .venv/bin/activate   # macOS / Linux
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create the env file from the template and fill in the keys:
   ```bash
   Copy-Item .env.example .env   # Windows
   cp .env.example .env          # macOS / Linux
   ```
   - `OPENCODE_API_KEY` — **required** for AI chat.
   - `SUPABASE_URL` + `SUPABASE_ANON_KEY` — **required**; use the same project as the frontend.
   - `UNSPLASH_ACCESS_KEY` — optional; without it `/api/v1/dish-image` returns an empty list and the UI falls back to its placeholder art.
   - `INTERNAL_API_SECRET` — optional; only needed when the API is publicly deployed (the frontend forwards the same header).
   - `OPENCODE_MODEL` must be a model the gateway really serves — check `GET {OPENCODE_BASE_URL}/models`. The default is `deepseek-v4.1-flash`.
5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 2001 --reload
   ```
   Health check: <http://127.0.0.1:2001/healthz> · interactive docs: <http://127.0.0.1:2001/docs>

The frontend proxies `/api/chat` and `/api/dish-image` to `BACKEND_INTERNAL_URL`
(defaults to `http://127.0.0.1:2001/api/v1`), so no extra frontend env var is
needed for local development.

### Database (Supabase)
The schema lives in `fooday_frontend/supabase/`. Run the numbered `*.sql` files in
order in the Supabase SQL Editor (or `supabase db push` with the CLI).
`init_all.sql` provisions a fresh project; the numbered files are incremental
migrations. The app degrades gracefully when an optional column is missing, but
new features stay inactive until their migration has been applied.

---

## 🗺️ Roadmap / Next Steps

We are currently transitioning into **Phase 2**, which focuses on Data Migration and AI Integration:
- **Supabase Data Layer:** Migrating the local mocked dish catalog (`foods.ts`) to a public `foods` table in Supabase.
- **Cloud Favorites:** Moving `localStorage` favorites to a normalized `favorites` table synced securely to the user's Supabase session via Realtime.
- **Grounded AI:** Integrating the backend FastAPI service with Anthropic/Claude to query the live Supabase catalog and provide hyper-personalized recommendations based on the user's actual favorites and available menu items.

---

## 🎨 Design Philosophy
Fooday strictly enforces a highly polished, proprietary design language:
- **Colors:** Vibrant lavenders (`#8E97FD`), stark contrasts, and soft gradients.
- **Typography:** `Plus Jakarta Sans` for display headings and `Inter` for functional sans-serif text (both with Vietnamese subsets).
- **Motion:** Micro-animations on all interactive elements.
- **Accessibility:** Minimum `44px` touch targets enforced everywhere. Fluid `clamp()` typography to prevent layout shifts.
