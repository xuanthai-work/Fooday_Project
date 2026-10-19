from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api import router as chat_router

app = FastAPI(title="Fooday API")

# Restrict CORS to the known frontend origins. A wildcard origin combined with
# allow_credentials=True is rejected/insecure, so list the dev origins explicitly.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1")


@app.get("/")
def read_root():
    return {"message": "Server is running! Go to /docs to test Chat API."}


if __name__ == "__main__":
    # reload=True restarts the server automatically when source files change.
    uvicorn.run("app.main:app", host="127.0.0.1", port=2001, reload=True)