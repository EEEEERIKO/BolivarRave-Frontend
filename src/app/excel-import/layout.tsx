import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Importar Horarios",
  description: "Importa horarios académicos desde archivos Excel al sistema del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Importar Horarios",
    description: "Carga masiva de horarios desde Excel.",
    url: "https://administracion-bolivar-rave.vercel.app/excel-import",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Importar",
    description: "Importar horarios desde Excel.",
  },
};

export default function ExcelImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
