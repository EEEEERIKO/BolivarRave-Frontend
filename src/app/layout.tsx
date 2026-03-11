import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@fontsource/material-symbols-outlined";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "UNAC Bolivar | Horarios",
  description: "Frontend base para gestion de horarios academicos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${inter.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
