import 'package:flutter/material.dart';
import 'chat_service.dart'; // Import file service vừa tạo

class ChatView extends StatefulWidget {
  const ChatView({super.key});

  @override
  State<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<ChatView> {
  final Color primaryColor = const Color(0xFF8E97FD);
  final Color aiBubbleColor = const Color.fromARGB(255, 218, 221, 226);
  final Color userBubbleColor = const Color(0xFF8E97FD);

  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController =
      ScrollController(); // Để tự cuộn xuống cuối

  bool _isLoading = false; // Biến để hiện trạng thái "AI đang trả lời..."

  // Dữ liệu tin nhắn
  final List<Map<String, dynamic>> _messages = [
    {
      "isUser": false,
      "message": "Chào bạn! Mình là trợ lý AI. Hôm nay bạn muốn ăn món gì?",
      "time": "Now",
    },
  ];

  // Hàm gửi tin nhắn
  void _handleSendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    // 1. Hiện tin nhắn của User lên màn hình ngay lập tức
    setState(() {
      _messages.add({"isUser": true, "message": text, "time": "Now"});
      _isLoading = true; // Bật trạng thái loading
      _controller.clear();
    });
    _scrollToBottom();

    // 2. Gọi API Python (bất đồng bộ)
    final response = await ChatService.sendMessage(text);

    // 3. Xử lý kết quả trả về
    if (mounted) {
      // Kiểm tra xem màn hình còn hiển thị không
      setState(() {
        _isLoading = false; // Tắt loading

        if (response != null) {
          // Lấy câu trả lời từ Python
          String aiReply = response['reply'];

          // Thêm tin nhắn của AI vào list
          _messages.add({"isUser": false, "message": aiReply, "time": "Now"});

          // Nếu có action (Ví dụ: mở bản đồ), ta sẽ xử lý sau
          // if (response['action'] == 'open_map') { ... }
        } else {
          // Trường hợp lỗi mạng
          _messages.add({
            "isUser": false,
            "message": "Xin lỗi, mình bị mất kết nối với máy chủ rồi 😢",
            "time": "Now",
          });
        }
      });
      _scrollToBottom();
    }
  }

  void _scrollToBottom() {
    // Cuộn xuống cuối sau 1 chút delay để list view kịp render
    Future.delayed(const Duration(milliseconds: 100), () {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: primaryColor, width: 2),
              ),
              child: const CircleAvatar(
                radius: 18,
                backgroundImage: NetworkImage(
                  "https://cdn-icons-png.flaticon.com/512/4712/4712027.png",
                ),
                backgroundColor: Colors.white,
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Foodie AI",
                  style: TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.bold,
                    fontSize: 18,
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: Colors.green,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 5),
                    Text(
                      "Online",
                      style: TextStyle(color: Colors.grey[500], fontSize: 12),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: _scrollController, // Gắn controller
              padding: const EdgeInsets.all(20),
              physics: const BouncingScrollPhysics(),
              itemCount: _messages.length,
              itemBuilder: (context, index) {
                final msg = _messages[index];
                return _buildMessageBubble(
                  message: msg['message'],
                  isUser: msg['isUser'],
                  time: msg['time'],
                );
              },
            ),
          ),

          // Hiệu ứng "AI is typing..."
          if (_isLoading)
            Padding(
              padding: const EdgeInsets.only(left: 20, bottom: 10),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  "AI is thinking...",
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontStyle: FontStyle.italic,
                    fontSize: 12,
                  ),
                ),
              ),
            ),

          _buildInputArea(),
        ],
      ),
    );
  }

  Widget _buildMessageBubble({
    required String message,
    required bool isUser,
    required String time,
  }) {
    return Column(
      crossAxisAlignment:
          isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.75,
          ),
          decoration: BoxDecoration(
            color: isUser ? userBubbleColor : aiBubbleColor,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(20),
              topRight: const Radius.circular(20),
              bottomLeft:
                  isUser ? const Radius.circular(20) : const Radius.circular(0),
              bottomRight:
                  isUser ? const Radius.circular(0) : const Radius.circular(20),
            ),
          ),
          child: Text(
            message,
            style: TextStyle(
              color: isUser ? Colors.white : Colors.black87,
              fontSize: 15,
              height: 1.4,
            ),
          ),
        ),
        const SizedBox(height: 5),
        Text(time, style: TextStyle(color: Colors.grey[400], fontSize: 11)),
      ],
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white12,
        boxShadow: [
          BoxShadow(
            color: Colors.grey.withValues(alpha: 0.05),
            offset: const Offset(0, -5),
            blurRadius: 10,
          ),
        ],
      ),
      child: SafeArea(
        child: Row(
          children: [
            IconButton(
              onPressed: () {},
              icon: Icon(Icons.add_circle, color: primaryColor, size: 28),
            ),
            const SizedBox(width: 5),
            Expanded(
              child: Container(
                height: 35,
                decoration: BoxDecoration(
                  color: const Color(0xFFF6F6F6),
                  borderRadius: BorderRadius.circular(25),
                  border: Border.all(color: Color(0xFF8E97FD)),
                ),
                child: Padding(
                  padding: const EdgeInsets.only(left: 15, bottom: 12),
                  child: TextField(
                    controller: _controller,
                    decoration: const InputDecoration(
                      hintText: "Ask AI for suggestions...",
                      hintStyle: TextStyle(fontSize: 15),
                      border: InputBorder.none,
                    ),
                    // Gửi khi bấm Enter trên bàn phím ảo
                    onSubmitted: (_) => _handleSendMessage(),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 10),
            GestureDetector(
              onTap: _handleSendMessage, // Gọi hàm gửi khi bấm nút
              child: const Icon(
                Icons.send_rounded,
                color: Color(0xFF8E97FD),
                size: 20,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
