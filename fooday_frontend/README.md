# Fooday — Frontend 🍱

High-performance, mobile-first food discovery application built with **Next.js 16 (App Router)**, **React 19**, and **TypeScript**.

---

## 🚀 Quick Start (Local Development)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Update the values:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:2001/api/v1
```

### 3. Run development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## ☁️ Deploy to Vercel

1. Push this repository (`Fooday_Project`) to GitHub.
2. Go to **[vercel.com/new](https://vercel.com/new)** and import `Fooday_Project`.
3. In project configuration:
   - **Root Directory**: Click *Edit* and select **`fooday_frontend`**.
   - **Framework Preset**: Next.js (automatically detected).
4. Add **Environment Variables**:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your Supabase Anon key
   - `NEXT_PUBLIC_API_URL` = your deployed backend API URL (e.g. `https://fooday-backend.onrender.com/api/v1`)
5. Click **Deploy**!
