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
      <body className="min-h-[100dvh] flex flex-col bg-background text-foreground font-sans">
        {children}
      </body>
    </html>
  );
}
