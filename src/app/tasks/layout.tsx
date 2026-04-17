import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "UNAC Bolivar | Tareas y Asignaciones",
  description: "Gestiona tareas, asignaciones y seguimiento del personal del Auditorio Bolivar.",
  openGraph: {
    title: "UNAC Bolivar | Gestión de Tareas",
    description: "Sistema de asignación y seguimiento de tareas del Auditorio Bolivar.",
    url: "https://administracion-bolivar-rave.vercel.app/tasks",
    siteName: "UNAC Bolivar",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "UNAC Bolivar | Tareas",
    description: "Gestión de tareas y asignaciones.",
  },
};

export default function TasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
