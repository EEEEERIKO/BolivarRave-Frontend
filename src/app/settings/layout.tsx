import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Configuración",
  description: "Configuración y ajustes del sistema del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Configuración del Sistema",
    description: "Parámetros y ajustes de la plataforma.",
    url: "https://administracion-bolivar-rave.vercel.app/settings",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Configuración",
    description: "Ajustes del sistema.",
  },
};

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
