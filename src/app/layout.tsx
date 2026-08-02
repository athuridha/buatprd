import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BuatPRD — AI-Assisted PRD Generator for Vibe Coding",
  description:
    "Ubah ide mentah jadi PRD profesional yang siap dipakai untuk AI coding tools. Powered by AI yang paham konteks project kamu.",
  keywords: [
    "PRD",
    "vibe coding",
    "AI",
    "product requirements",
    "generator",
  ],
};

import { AuthProvider } from "@/context/AuthContext";
import { ModelProvider } from "@/context/ModelContext";
import { ChatProvider } from "@/context/ChatContext";
import Navbar from "@/components/Navbar";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col bg-background text-foreground font-sans">
        <AuthProvider>
          <ModelProvider>
            <ChatProvider>
              <Navbar />
              <main className="flex-1 h-0 min-h-0 overflow-y-auto flex flex-col relative">
                {children}
              </main>
            </ChatProvider>
          </ModelProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
