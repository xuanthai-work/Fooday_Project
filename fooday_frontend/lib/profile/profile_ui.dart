import 'package:flutter/material.dart';

class ProfileView extends StatefulWidget {
  const ProfileView({super.key});

  @override
  State<ProfileView> createState() => _ProfileViewState();
}

class _ProfileViewState extends State<ProfileView>
    with SingleTickerProviderStateMixin {
  // Màu chủ đạo
  final Color primaryColor = const Color(0xFF8E97FD);
  final Color greyColor = const Color(0xFFF6F6F6);

  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    // Khởi tạo TabController với 3 tab: Favorites, History, Settings
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // --- 1. HEADER PROFILE (Cong tròn bên dưới) ---
            Stack(
              children: [
                // Nền xanh
                Container(
                  height: 130,
                  width: double.infinity,
                  decoration: BoxDecoration(color: primaryColor),
                  child: SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          IconButton(
                            onPressed: () {},
                            icon: const Icon(
                              Icons.settings,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(
                        top: 10,
                        left: 10,
                        right: 20,
                      ),
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                        ),
                        child: const CircleAvatar(
                          radius: 50,
                          backgroundImage: NetworkImage(
                            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=80",
                          ),
                        ),
                      ),
                    ),
                    Column(
                      mainAxisAlignment: MainAxisAlignment.start,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Deny Smith",
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),

                        Row(
                          children: [
                            const Icon(
                              Icons.email,
                              color: Colors.black,
                              size: 13,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              "denysmith@gmail.com",
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.black,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            const Icon(
                              Icons.location_on,
                              color: Colors.black,
                              size: 13,
                            ),
                            const SizedBox(width: 5),
                            Text(
                              "address, city, state",
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.black,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),

            // --- 3. TAB BAR (Favorites, History, Settings) ---
            TabBar(
              controller: _tabController,
              labelColor: primaryColor,
              unselectedLabelColor: Colors.grey,
              indicatorColor: primaryColor,
              indicatorWeight: 3,
              labelStyle: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
              tabs: const [Tab(text: "Favorites"), Tab(text: "History")],
            ),

            const SizedBox(height: 10),

            // --- 4. TAB VIEW (Nội dung danh sách) ---
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Tab 1: Favorites List
                  _buildFavoriteList(),
                  // Tab 2: History (Placeholder)
                  const Center(child: Text("No history yet")),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Hàm dựng danh sách món ăn yêu thích
  Widget _buildFavoriteList() {
    // Dữ liệu giả lập
    final List<Map<String, dynamic>> favoriteFoods = [
      {
        "name": "Spicy Noodles",
        "restaurant": "Noodle House",
        "rating": 4.8,
        "image":
            "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      },
      {
        "name": "Beef Burger",
        "restaurant": "Burger King",
        "rating": 4.5,
        "image":
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      },
      {
        "name": "Healthy Salad",
        "restaurant": "Green Life",
        "rating": 4.9,
        "image":
            "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      },
      {
        "name": "Fried Chicken",
        "restaurant": "KFC",
        "rating": 4.2,
        "image":
            "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&q=60",
      },
    ];

    return ListView.builder(
      // Hiệu ứng bouncy và padding đáy
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(top: 10, bottom: 20, left: 20, right: 20),
      itemCount: favoriteFoods.length,
      itemBuilder: (context, index) {
        final item = favoriteFoods[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 15),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(15),
            boxShadow: [
              BoxShadow(
                color: Colors.grey.withValues(alpha: 0.1),
                blurRadius: 10,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            children: [
              // Ảnh nhỏ bên trái
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Image.network(
                  item['image'],
                  width: 70,
                  height: 70,
                  fit: BoxFit.cover,
                  errorBuilder:
                      (context, error, stackTrace) => Container(
                        width: 70,
                        height: 70,
                        color: Colors.grey[300],
                      ),
                ),
              ),
              const SizedBox(width: 15),
              // Thông tin giữa
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['name'],
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      item['restaurant'],
                      style: TextStyle(color: Colors.grey[500], fontSize: 14),
                    ),
                    const SizedBox(height: 5),
                    Row(
                      children: [
                        const Icon(Icons.star, color: Colors.amber, size: 16),
                        const SizedBox(width: 4),
                        Text(
                          "${item['rating']}",
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Nút mũi tên bên phải
              IconButton(
                onPressed: () {},
                icon: const Icon(
                  Icons.arrow_forward_ios,
                  size: 16,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
