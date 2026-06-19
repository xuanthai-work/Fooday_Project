from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.api import router as chat_router

app = FastAPI(title="What To Eat Today API")

# Allow any origin/method/header so the web and mobile clients can call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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