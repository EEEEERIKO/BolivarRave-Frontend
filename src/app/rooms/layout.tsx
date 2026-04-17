import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Salones y Espacios",
  description: "Consulta la disponibilidad y características de los salones del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Catálogo de Salones",
    description: "Información completa sobre salones disponibles en el Auditorio Bolivar.",
    url: "https://administracion-bolivar-rave.vercel.app/rooms",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Salones",
    description: "Consulta salones disponibles.",
  },
};

export default function RoomsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
