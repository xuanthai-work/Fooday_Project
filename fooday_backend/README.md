# Fooday — AI Backend 🍲

Lightweight, high-speed Python **FastAPI** service powering the AI food recommendation engine for Fooday.

---

## 🚀 Quick Start (Local Development)

### 1. Setup Python Virtual Environment
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate
```

### 2. Install dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure environment variables
Create `.env` based on `.env.example`:
```env
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_or_service_key
FRONTEND_URL=http://localhost:3000
```

### 4. Run development server
```bash
python -m app.main
# Or via uvicorn directly:
uvicorn app.main:app --host 127.0.0.1 --port 2001 --reload
```
Open [http://localhost:2001/docs](http://localhost:2001/docs) for interactive Swagger API documentation.

---

## ☁️ Deploy to Render / Railway

### Deploying to [Render.com](https://render.com) (Free Web Service)
1. Push this repository to GitHub.
2. In Render Dashboard, click **New +** $\rightarrow$ **Web Service** $\rightarrow$ connect `Fooday_Project`.
3. Set **Root Directory**: `fooday_backend`
4. Settings:
   - **Environment**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
5. Add Environment Variables:
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `SUPABASE_URL`: Your Supabase Project URL
   - `SUPABASE_KEY`: Your Supabase API Key
   - `FRONTEND_URL`: Your deployed Vercel URL (e.g. `https://fooday.vercel.app`)
6. Click **Deploy Web Service**!
