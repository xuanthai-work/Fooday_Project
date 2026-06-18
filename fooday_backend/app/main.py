from fastapi import FastAPI
import uvicorn
from app.api import router as chat_router
# 1. Import thêm cái này
from fastapi.middleware.cors import CORSMiddleware 

app = FastAPI(
    title="What To Eat Today API",
    # ...
)

# 2. Thêm đoạn cấu hình CORS này vào (Ngay dưới dòng khai báo app = FastAPI)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép mọi nguồn truy cập (Web, Mobile...)
    allow_credentials=True,
    allow_methods=["*"], # Cho phép mọi phương thức (GET, POST...)
    allow_headers=["*"],
)

app.include_router(chat_router, prefix="/api/v1")

@app.get("/")
def read_root():
    return {"message": "Server is running! Go to /docs to test Chat API."}

if __name__ == "__main__":
    # Reload=True giúp server tự khởi động lại khi bạn sửa code
    uvicorn.run("app.main:app", host="127.0.0.1", port=2001, reload=True)