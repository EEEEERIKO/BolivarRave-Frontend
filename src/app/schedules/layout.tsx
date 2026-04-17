import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Gestión de Horarios",
  description: "Administra, consulta e importa los horarios académicos del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Horarios Académicos",
    description: "Plataforma para gestión de horarios del Auditorio Bolivar UNAC.",
    url: "https://administracion-bolivar-rave.vercel.app/schedules",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Horarios",
    description: "Gestión de horarios académicos.",
  },
};

export default function SchedulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
