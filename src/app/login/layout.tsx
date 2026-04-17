import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Login",
  description: "Acceso a los portales administrativo y de colaboradores del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Ingreso Seguro",
    description: "Plataforma de gestión de horarios y personal del Auditorio Bolivar.",
    url: "https://administracion-bolivar-rave.vercel.app/login",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Ingreso",
    description: "Plataforma de gestión del Auditorio Bolivar.",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
