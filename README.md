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
   Create a `.env.local` file based on `.env.example` and add your Supabase URL and Anon Key.
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_API_URL=http://localhost:2001/api/v1
   ```
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
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 2001 --reload
   ```

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
- **Typography:** `Outfit` for display headings and `Inter` for functional sans-serif text.
- **Motion:** Micro-animations on all interactive elements.
- **Accessibility:** Minimum `44px` touch targets enforced everywhere. Fluid `clamp()` typography to prevent layout shifts.
