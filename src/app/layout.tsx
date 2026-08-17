import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Pharmacy Management",
  description: "Quản lý danh mục, tồn kho theo lô và bán hàng cho nhà thuốc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
