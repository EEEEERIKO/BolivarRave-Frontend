import type { Metadata } from "next";
import "@fontsource/material-symbols-outlined";
import "./globals.css";
import { AdminShell } from "@/components/layout/admin-shell";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Horarios",
  description: "Frontend base para gestion de horarios academicos.",
  icons: {
    icon: "/icon.png?v=5",
    shortcut: "/icon.png?v=5",
    apple: "/icon.png?v=5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased" suppressHydrationWarning>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
