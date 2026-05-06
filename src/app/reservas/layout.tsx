import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Reservas",
  description: "Gestiona solicitudes de reservas con el estilo visual del sistema de horarios UNAC Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Reservas",
    description: "Gestión de reservas de recursos y espacios académicos.",
    url: "https://administracion-bolivar-rave.vercel.app/reservas",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Reservas",
    description: "Gestión de reservas de recursos y espacios académicos.",
  },
};

export default function ReservasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
