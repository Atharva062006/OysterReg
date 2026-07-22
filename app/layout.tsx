import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import ClientBackground from "@/components/ClientBackground";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oyster Kode Club — Recruitment 2026",
  description:
    "Register for the Oyster Kode Club recruitment drive. Fill in your details to apply.",
  icons: {
    icon: "/logo4.png",
    apple: "/logo4.png",
  },
};


export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets content reach notch/island edges
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ClientBackground />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
