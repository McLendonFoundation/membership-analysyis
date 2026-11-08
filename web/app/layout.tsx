import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Membership Dashboard",
  description: "Association membership insights, structured with the NACDA Framework. Created by Ishita Tibrewal.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
