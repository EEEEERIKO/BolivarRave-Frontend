import type { Metadata } from "next";
import { Suspense } from "react";
import "@fontsource/material-symbols-outlined";
import "./globals.css";
import { AdminShell } from "@/components/layout/admin-shell";

const routeMetadata: Record<string, { title: string; description: string }> = {
  "/": {
    title: "UNAC Bolivar | Horarios",
    description: "Gestión integral de horarios académicos y reservas de espacios.",
  },
  "/login/colaborador": {
    title: "UNAC Bolivar | Portal Colaborador",
    description: "Acceso para colaboradores y personal del Auditorio Bolivar.",
  },
  "/login/admin": {
    title: "UNAC Bolivar | Portal Administrativo",
    description: "Portal administrativo para gestión de horarios y personal.",
  },
  "/schedules": {
    title: "UNAC Bolivar | Gestión de Horarios",
    description: "Administra los horarios académicos del Auditorio Bolivar.",
  },
  "/staff": {
    title: "UNAC Bolivar | Gestión de Personal",
    description: "Administra el personal y colaboradores del Auditorio Bolivar.",
  },
  "/registro": {
    title: "UNAC Bolivar | Registro de Turno",
    description: "Registra la entrada y salida del personal según su jornada laboral.",
  },
  "/auditorio": {
    title: "UNAC Bolivar | Reservas de Espacios",
    description: "Reserva y administra los espacios del Auditorio Bolivar.",
  },
  "/reservas": {
    title: "UNAC Bolivar | Reservas",
    description: "Solicita salones y equipos con el sistema visual de UNAC Bolivar.",
  },
  "/rooms": {
    title: "UNAC Bolivar | Salones y Espacios",
    description: "Consulta la disponibilidad de salones en el Auditorio Bolivar.",
  },
  "/tasks": {
    title: "UNAC Bolivar | Tareas y Asignaciones",
    description: "Gestiona tareas y asignaciones del personal.",
  },
  "/excel-import": {
    title: "UNAC Bolivar | Importar Horarios",
    description: "Importa horarios desde archivos Excel.",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  // Nota: Para obtener la ruta actual en generateMetadata(), necesitarías usar headers()
  // de Next.js, pero eso solo te da headers, no el pathname directamente.
  // Por ahora usamos una metadata por defecto mejorada.

  return {
    title: "UNAC Bolivar | Horarios",
    description: "Gestión integral de horarios académicos y reservas de espacios en el Auditorio Bolivar.",
    icons: {
      icon: "/icon.png?v=5",
      shortcut: "/icon.png?v=5",
      apple: "/icon.png?v=5",
    },
    openGraph: {
      title: "UNAC Bolivar | Horarios",
      description: "Gestión integral de horarios académicos y reservas de espacios en el Auditorio Bolivar.",
      url: "https://administracion-bolivar-rave.vercel.app",
      siteName: "UNAC Bolivar",
      images: [
        {
          url: "/icon.png?v=5",
          width: 192,
          height: 192,
          alt: "UNAC Bolivar Logo",
        },
      ],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "UNAC Bolivar | Horarios",
      description: "Gestión integral de horarios académicos y reservas de espacios.",
      images: ["/icon.png?v=5"],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <meta name="theme-color" content="#1f2937" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <Suspense fallback={null}>
          <AdminShell>{children}</AdminShell>
        </Suspense>
      </body>
    </html>
  );
}
