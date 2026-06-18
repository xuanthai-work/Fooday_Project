import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import StyledJsxRegistry from "./registry";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fooday — What To Eat Today",
  description:
    "Your AI-powered food companion. Discover dishes you'll love and ask Foodie AI what to eat today.",
  keywords:
    "food, restaurant, what to eat, AI, menu, recommendation, phở, burger, ramen",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#8E97FD",
};

// Applies a saved theme before first paint so dark mode never flashes.
const themeScript = `(function(){try{var t=localStorage.getItem('fooday-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <StyledJsxRegistry>{children}</StyledJsxRegistry>
      </body>
    </html>
  );
}
