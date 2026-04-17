import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Gestión de Personal",
  description: "Administra el personal, colaboradores y monitores del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Personal y Colaboradores",
    description: "Sistema de gestión de personal del Auditorio Bolivar UNAC.",
    url: "https://administracion-bolivar-rave.vercel.app/staff",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Personal",
    description: "Gestión de personal y colaboradores.",
  },
};

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
