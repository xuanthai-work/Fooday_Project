import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api import router as chat_router

app = FastAPI(title="Fooday API")

# Configure CORS: Allow local dev origins + any configured FRONTEND_URL or Vercel preview/production domains
extra_origins = [o.strip() for o in os.getenv("FRONTEND_URL", "").split(",") if o.strip()]
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    *extra_origins,
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Server is running! Go to /docs to test Chat API."}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", 2001))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)