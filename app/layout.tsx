import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LAKA Kho — Quản lý kho & cấp phát",
  description: "Nhập hàng, cấp phát, kiểm kê và theo dõi tồn kho LAKA.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className="antialiased">{children}</body>
    </html>
  );
}
