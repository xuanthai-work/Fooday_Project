import type { Metadata, Viewport } from "next";
import { Outfit, Inter } from "next/font/google";
import StyledJsxRegistry from "./registry";
import AppShell from "@/components/AppShell";
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
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
    shortcut: "/fooday-mark.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  // "cover" lets the app extend under the notch / rounded corners and makes
  // env(safe-area-inset-*) resolve to real values on iOS (PWA & Safari).
  viewportFit: "cover",
  themeColor: "#FF6B35",
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
        <StyledJsxRegistry>
          <AppShell>{children}</AppShell>
        </StyledJsxRegistry>
      </body>
    </html>
  );
}
