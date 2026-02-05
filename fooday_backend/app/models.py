from pydantic import BaseModel
from typing import Optional, List

# 1. Dữ liệu Flutter gửi lên (Request)
class ChatRequest(BaseModel):
    user_message: str          # Tin nhắn người dùng nhập (VD: "Ăn gì ở Cầu Giấy?")
    user_id: Optional[str] = "guest" # ID người dùng (để nhớ lịch sử chat sau này)

# 2. Dữ liệu Server trả về (Response)
class ChatResponse(BaseModel):
    reply: str                 # Câu trả lời của AI (VD: "Bạn thử quán Phở Lý Quốc Sư nhé...")
    action: Optional[str] = None # Hành động kèm theo (VD: "open_map", "show_menu")
    suggested_dishes: Optional[List[str]] = [] # Gợi ý món ăn kèm theo (nếu có)