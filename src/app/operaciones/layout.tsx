import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Centro de Mando",
  description: "Panel operativo para limpieza, reportes, personal y préstamos activos del Edificio Bolívar.",
  openGraph: {
    title: "UNAC Bolivar | Centro de Mando",
    description: "Tablero operativo con prioridades, salones sin aseo, personal y alertas en tiempo real.",
    url: "https://administracion-bolivar-rave.vercel.app/operaciones",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UNAC Bolivar | Centro de Mando",
    description: "Panel operativo para el monitoreo administrativo.",
  },
};

export default function OperacionesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}