import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oyster Kode Club — Recruitment 2026",
  description:
    "Register for the Oyster Kode Club recruitment drive. Fill in your details to apply.",
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
