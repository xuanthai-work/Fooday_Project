from fastapi import APIRouter
from app.models import ChatRequest, ChatResponse
import time

# Tạo một bộ định tuyến (Router) để quản lý các API chat
router = APIRouter()

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    API nhận tin nhắn từ người dùng và trả về phản hồi của AI.
    """
    user_msg = request.user_message.lower()
    
    # --- LOGIC XỬ LÝ GIẢ LẬP (SAU NÀY SẼ LÀ AI AGENT) ---
    
    # Giả lập độ trễ "suy nghĩ" của AI (1 giây)
    # Vì dùng async, server vẫn có thể phục vụ người khác trong lúc chờ
    # await asyncio.sleep(1) 
    
    ai_reply = ""
    action = None
    dishes = []

    if "ăn gì" in user_msg:
        ai_reply = "Chào bạn! Dựa trên vị trí của bạn, mình gợi ý vài món nước ấm nóng nhé?"
        action = "show_recommendation"
        dishes = ["Phở Bò", "Bún Riêu", "Mì Cay"]
        
    elif "cay" in user_msg:
        ai_reply = "Okaay, nếu thích ăn cay thì Mì Cay 7 Cấp Độ là chuẩn bài!"
        action = "open_map" # Ví dụ: Bảo Flutter mở bản đồ quán mì cay
        
    else:
        ai_reply = f"Mình nhận được tin nhắn: '{request.user_message}'. Nhưng mình chưa đủ thông minh để hiểu câu này. Bạn hỏi về món ăn đi!"

    # Trả kết quả về theo đúng mẫu đã định nghĩa
    return ChatResponse(
        reply=ai_reply,
        action=action,
        suggested_dishes=dishes
    )