import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Portal Colaborador",
  description: "Acceso para colaboradores, monitores y personal del Auditorio Bolivar UNAC.",
  openGraph: {
    title: "UNAC Bolivar | Ingreso Colaboradores",
    description: "Portal de colaboradores - Auditorio Bolivar UNAC. Gestiona tus tareas, horarios y disponibilidad.",
    url: "https://administracion-bolivar-rave.vercel.app/login/colaborador",
    siteName: "UNAC Bolivar",
    type: "website",
    images: [
      {
        url: "/icon.png?v=5",
        width: 192,
        height: 192,
        alt: "UNAC Bolivar",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Colaboradores",
    description: "Portal de acceso para colaboradores del Auditorio Bolivar.",
  },
};

export default function ColaboradorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
