import type { Metadata, Viewport } from "next";
import { Tiro_Devanagari_Sanskrit } from "next/font/google";

import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/lib/auth/AuthContext";

// Tiro Devanagari Sanskrit — a serif designed specifically for Sanskrit
// (samyuktakshara ligatures, vedic marks). Exposed as a CSS variable so any
// component can reach for it with `var(--font-deva)`.
const tiroDevanagari = Tiro_Devanagari_Sanskrit({
  weight: "400",
  subsets: ["devanagari", "latin"],
  variable: "--font-deva",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kayachikitsa Sutras",
  description: "Explore the world of Ayurveda with Kayachikitsa Sutras, a platform for learning and practicing Ayurvedic medicine.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#A67C52",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={tiroDevanagari.variable}>
      <body>
        <AuthProvider>
          <Navbar />
          {children}
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
