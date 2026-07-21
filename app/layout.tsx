import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oyster Coding Club — Recruitment 2025",
  description:
    "Register for the Oyster Coding Club recruitment drive. Fill in your details to apply.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
