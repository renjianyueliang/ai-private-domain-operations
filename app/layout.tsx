import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 私域 SaaS 指挥官",
  description: "指挥多个 AI 员工自动协同完成多行业私域运营流程。",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
