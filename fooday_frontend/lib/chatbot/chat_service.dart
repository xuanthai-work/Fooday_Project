import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart'; // Import thư viện này để check nền tảng

class ChatService {
  // Thay biến baseUrl cũ bằng hàm getter thông minh này
  static String get baseUrl {
    if (kIsWeb) {
      return "http://127.0.0.1:8000/api/v1/chat"; // Dành cho Web Chrome
    } else {
      return "http://10.0.2.2:8000/api/v1/chat"; // Dành cho Android Emulator
    }
  }

  static Future<Map<String, dynamic>?> sendMessage(String message) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl), // Gọi hàm getter ở trên
        headers: {"Content-Type": "application/json"},
        body: jsonEncode({"user_message": message, "user_id": "flutter_user"}),
      );

      if (response.statusCode == 200) {
        // Giải mã JSON từ Server trả về
        // Server trả về: { "reply": "...", "action": "...", "suggested_dishes": [...] }
        // Ta cần lấy tiếng Việt có dấu đúng chuẩn
        return jsonDecode(utf8.decode(response.bodyBytes));
      } else {
        print("Lỗi Server: ${response.statusCode}");
        return null;
      }
    } catch (e) {
      print("Lỗi kết nối: $e");
      return null;
    }
  }
}
