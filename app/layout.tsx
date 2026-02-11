import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monday + Partners Time",
  description: "Elegant, pared-back time tracking for creative work."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
