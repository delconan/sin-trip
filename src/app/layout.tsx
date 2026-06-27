import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "狮城小队 · 新加坡亲子行程",
  description: "两大两小的新加坡互动旅行手账",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}

