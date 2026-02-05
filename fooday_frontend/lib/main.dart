import 'package:flutter/material.dart';
import 'package:fooday_frontend/route/rootpage.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'What To Eat Today',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.blue,
        scaffoldBackgroundColor: Colors.white, // Nền trắng toàn app
        useMaterial3: true,
      ),
      home: RootPage(),
    );
  }
}
