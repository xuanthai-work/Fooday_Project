import 'package:flutter/material.dart';
import 'package:fooday_frontend/chatbot/chat_ui.dart';
import 'package:fooday_frontend/home/home_view.dart';
import 'package:fooday_frontend/profile/profile_ui.dart';

// Import các trang con để điều hướng
class RootPage extends StatefulWidget {
  const RootPage({super.key});

  @override
  State<RootPage> createState() => _RootPageState();
}

class _RootPageState extends State<RootPage> {
  int _selectedIndex = 0;
  final Color primaryColor = const Color(0xFF8E97FD);

  // Danh sách các màn hình
  final List<Widget> _screens = [
    const HomePage(), // Index 0: Home
    const ChatView(), // Index 1
    const ProfileView(), // Index 3: Profile
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // IndexedStack giữ trạng thái của các trang khi chuyển tab
      // (Ví dụ: Đang cuộn dở ở Home, sang Profile rồi quay lại vẫn ở chỗ cũ)
      body: IndexedStack(index: _selectedIndex, children: _screens),

      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: Colors.white,
        selectedItemColor: primaryColor,
        unselectedItemColor: Colors.grey,
        showSelectedLabels: false,
        showUnselectedLabels: false,
        type: BottomNavigationBarType.fixed,
        currentIndex: _selectedIndex,
        onTap: (index) {
          setState(() {
            _selectedIndex = index;
          });
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_filled), label: "Home"),
          BottomNavigationBarItem(icon: Icon(Icons.chat), label: "AI"),
          BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            label: "Profile",
          ),
        ],
      ),
    );
  }
}
