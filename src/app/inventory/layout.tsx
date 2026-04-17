import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Inventario",
  description: "Sistema de control de inventario del Auditorio Bolivar UNAC.",
  openGraph: {
    title: "UNAC Bolivar | Gestión de Inventario",
    description: "Gestiona el inventario y recursos del Auditorio Bolivar.",
    url: "https://administracion-bolivar-rave.vercel.app/inventory",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Inventario",
    description: "Control de inventario.",
  },
};

export default function InventoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
