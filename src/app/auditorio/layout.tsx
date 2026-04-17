import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Reservas de Espacios",
  description: "Reserva y administra los espacios y auditorios del Auditorio Bolivar UNAC.",
  openGraph: {
    title: "UNAC Bolivar | Sistema de Reservas",
    description: "Plataforma para reservar espacios en el Auditorio Bolivar.",
    url: "https://administracion-bolivar-rave.vercel.app/auditorio",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Reservas",
    description: "Sistema de reserva de espacios del Auditorio Bolivar.",
  },
};

export default function AuditorioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
