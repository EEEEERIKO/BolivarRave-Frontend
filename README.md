# Informe técnico del frontend — UNAC Bolívar

## 1. Resumen ejecutivo

El frontend es una aplicación web de gestión académica, reservas, personal, inventario, tareas y operaciones para el edificio Bolívar Rave de la UNAC.

La aplicación está construida con:

- Next.js 16.1.6 usando App Router.
- React 19.2.3.
- TypeScript 5 con modo estricto.
- Tailwind CSS 4 mediante PostCSS.
- Vercel como plataforma de despliegue del frontend.
- Un backend independiente, normalmente desplegado en Render.
- Socket.IO para actualizaciones de horarios en tiempo real.
- Resend, utilizado por el backend, no directamente por el frontend.

El frontend funciona principalmente como una SPA enriquecida: las páginas se renderizan con componentes React cliente, mantienen estado local y consumen endpoints HTTP del backend.

## 2. Estructura del proyecto

```text
frontend/
├── public/                         Recursos estáticos e imágenes
├── src/
│   ├── app/                        Rutas y páginas de Next.js
│   │   ├── api/                    Proxies hacia el backend
│   │   ├── public/                 Páginas públicas sin sesión
│   │   ├── login/                  Inicio de sesión
│   │   └── .../page.tsx             Módulos funcionales
│   ├── components/
│   │   ├── layout/                 Shell administrativo y navegación
│   │   ├── dashboard/              Componentes del tablero
│   │   └── ui/                     Componentes visuales reutilizables
│   └── lib/                        API, sesión, caché, WebSocket y utilidades
├── next.config.ts                  Reescrituras hacia el backend
├── tsconfig.json                   TypeScript y alias @/*
├── eslint.config.mjs               ESLint/Next Core Web Vitals
└── package.json                    Scripts y dependencias
```

El alias `@/*` apunta a `src/*`; por ejemplo:

```ts
import { fetchApiJson } from "@/lib/api-client";
```

## 3. Rutas de usuario

### Rutas públicas

- `/public/auditorio`: calendario público y formulario para solicitar reservas del auditorio sin cuenta.
- `/public/horarios`: consulta pública de horarios/reservas.
- `/reservas/confirm`: página pública que procesa el enlace de confirmación enviado por correo.
- `/login`: acceso administrativo y de monitores.
- `/login/colaborador`: acceso para colaboradores.

### Rutas administrativas

- `/`: tablero principal.
- `/schedules`: creación, edición, importación y gestión de horarios académicos.
- `/rooms`: disponibilidad, estado, limpieza, daños y equipamiento de salones.
- `/auditorio`: administración de solicitudes y reservas del auditorio.
- `/reservas`: reservas de salones, equipos y televisores.
- `/staff`: directorio, perfiles, jornadas y pausas del personal.
- `/registro`: control de asistencia y turnos.
- `/tasks`: catálogo, asignaciones, habilidades y seguimiento de tareas.
- `/inventory`: grupos y elementos de inventario.
- `/excel-import`: lectura, validación y confirmación de horarios Excel.
- `/operaciones`: tablero operativo en tiempo real.
- `/objetos-perdidos`: registro y seguimiento de objetos perdidos.
- `/habilidades`: mantenimiento de habilidades.
- `/lugares`: mantenimiento de lugares.
- `/settings`: cambio de contraseña y datos de cuenta.

Las restricciones de navegación se aplican visualmente en `AdminShell`, pero la autorización real debe permanecer en el backend.

## 4. Shell principal y control de acceso

`src/components/layout/admin-shell.tsx` es el contenedor común de la aplicación.

Responsabilidades principales:

- Renderizar el menú lateral y navegación móvil.
- Leer la sesión almacenada en el navegador.
- Redirigir a `/login` si una ruta privada no tiene sesión.
- Ocultar opciones de menú según el rol.
- Mostrar notificaciones de horarios y solicitudes del auditorio.
- Inicializar el WebSocket de horarios.
- Mostrar `Toaster` para mensajes globales.
- Dejar fuera del shell las rutas públicas y de login.

Los roles reconocidos son:

```text
admin
monitor
colaborador
registro
```

La sesión se guarda en `localStorage` con la clave `unac_auth_session_v1`. Incluye rol, nombre, cédula, `staffId` y token de acceso.

## 5. Autenticación

`src/lib/auth-session.ts` contiene las operaciones de sesión:

- `readAuthSession()`: lee y valida la sesión.
- `writeAuthSession()`: normaliza el rol y guarda la sesión.
- `clearAuthSession()`: elimina la sesión.
- `normalizeUserRole()`: adapta roles y etiquetas provenientes del backend.

El cliente API añade automáticamente:

```http
Authorization: Bearer <accessToken>
```

Cuando recibe un error de sesión, intenta renovar el token con `/api/staff/refresh`. Si la renovación falla, limpia la sesión y redirige al login en rutas privadas.

Importante para TI: el token está en `localStorage`. Esto simplifica el desarrollo, pero aumenta el impacto potencial de una vulnerabilidad XSS. Una evolución más segura sería usar cookies `HttpOnly`, `Secure` y `SameSite`.

## 6. Comunicación con el backend

La capa central es `src/lib/api-client.ts`.

### `fetchApiJson`

Es el método estándar para llamadas HTTP. Hace lo siguiente:

1. Construye candidatos de URL.
2. Prefiere el proxy del mismo origen (`/api/...`).
3. Añade el token Bearer si existe.
4. Envía cookies con `credentials: include`.
5. Lee y convierte la respuesta JSON.
6. Traduce errores técnicos a mensajes en español.
7. Intenta renovar la sesión ante ciertos errores 401/403.

### `fetchApiJsonWithRetry`

Reintenta errores relacionados con transacciones, usando backoff exponencial. La secuencia por defecto es aproximadamente 500 ms, 1 s y 2 s.

### Proxies y reescrituras

Existen dos mecanismos:

- `next.config.ts` define reescrituras `/api/*` hacia el backend.
- `src/app/api/*/[...path]/route.ts` contiene proxies explícitos para auditorio, horarios, staff, inventory, tasks y objetos perdidos.

En desarrollo:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

En producción, el frontend publicado en Vercel normalmente reenvía las peticiones al backend desplegado en Render. Por eso los logs de producción no aparecen en la terminal local.

## 7. Flujo de una solicitud pública de auditorio

El flujo de `/public/auditorio` es:

```text
Usuario completa formulario
        ↓
submitRequest() en public/auditorio/page.tsx
        ↓
POST /api/auditorio/public/reservas
        ↓
Proxy Next.js/Vercel
        ↓
Backend /api/auditorio/public/reservas
        ↓
Crear reserva Pendiente
        ↓
Crear solicitud pendiente para administración
        ↓
Enviar correo de solicitud registrada mediante Resend
        ↓
Responder 201 al frontend
```

La página valida fechas, anticipación mínima, correo, teléfono, horarios y solapamientos antes de enviar el POST.

## 8. Estado y patrón React

No se utiliza Redux, Zustand, React Query ni un gestor global de datos. El patrón predominante es:

- `useState` para formularios, selección y modales.
- `useEffect` para cargar datos y sincronizar eventos.
- `useMemo` para listas derivadas, filtros y cálculos.
- `useRef` para scroll, sockets y referencias DOM.
- `useCallback` no se usa de forma sistemática.

Ventajas:

- Sencillo de entender por página.
- Pocas dependencias adicionales.
- Adecuado para módulos independientes.

Riesgos:

- Algunas páginas son muy grandes y contienen demasiada lógica.
- Puede haber cargas duplicadas y estados difíciles de coordinar.
- Las dependencias de algunos hooks generan advertencias de ESLint.
- La invalidación de datos depende de cada página.

## 9. Actualizaciones en tiempo real

`src/lib/use-websocket-schedules.ts` usa `socket.io-client`.

El cliente:

- Se conecta al backend según `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_BACKEND_URL` o `NEXT_PUBLIC_API_BASE_URL`.
- En local usa polling por defecto.
- En producción permite polling y WebSocket.
- Se suscribe a `schedules`.
- Escucha `schedule:refresh` y `schedule:changed`.
- Limpia caché de horarios y ejecuta callbacks de refresco.
- Reintenta la conexión hasta diez veces.

El WebSocket actualiza horarios y notificaciones, pero no reemplaza las consultas HTTP iniciales.

## 10. Caché local

`src/lib/cache-storage.ts` implementa una caché pequeña sobre `localStorage`:

- Prefijo: `app_cache_`.
- TTL opcional en milisegundos.
- Lectura, escritura, eliminación individual y limpieza total.

Además, `/schedules` mantiene una caché propia para mostrar datos rápidamente mientras actualiza desde la API.

La caché es solamente una optimización de interfaz. Nunca debe considerarse fuente definitiva de datos.

## 11. Módulos funcionales principales

### Horarios

`/schedules` muestra una cuadrícula temporal, permite crear y editar eventos, gestionar solicitudes, buscar salones disponibles e importar datos. Utiliza WebSocket, caché local y reintentos para operaciones sensibles.

### Auditorio

`/auditorio` administra eventos del auditorio: calendario, edición, encargados, aprobación, rechazo, eliminación y exportación Excel. Consume APIs de auditorio y personal.

### Reservas

`/reservas` gestiona reservas de salones, equipos y televisores. Carga grupos y elementos de inventario, filtra disponibilidad por fecha/hora y permite devolver, cerrar, cancelar o reportar reservas.

### Personal

`/staff` combina directorio, datos laborales, tareas, jornadas semanales, pausas, movimientos de balance y estado operativo. La edición de horario maestro mantiene filas por día y detecta cambios sin guardar.

### Inventario

`/inventory` administra grupos y elementos, estados disponibles/defectuosos, ubicación y relaciones con salones.

### Tareas

`/tasks` concentra catálogo, espacios, habilidades, instancias, asignaciones y revisiones. Es uno de los módulos más grandes del frontend.

### Importación Excel

`/excel-import` analiza archivos en el navegador, muestra una vista previa, compara contra horarios existentes y envía la importación confirmada al backend. Usa `xlsx` y `xlsx-js-style`.

### Operaciones y registro

`/operaciones` presenta un tablero operativo de personal, salones, préstamos y tareas. `/registro` controla asistencia, previsualización y reportes.

## 12. Componentes y estilos

El estilo se basa principalmente en clases utilitarias Tailwind CSS.

Dependencias visuales relevantes:

- `lucide-react`: iconos SVG.
- `@fontsource/material-symbols-outlined`: iconos Material Symbols.
- `recharts`: gráficas.
- `@tanstack/react-table`: tablas.
- `react-rnd`: elementos redimensionables/movibles.
- `react-hot-toast`: notificaciones.
- Componentes propios estilo shadcn en `src/components/ui`.

`globals.css` contiene estilos globales, variables visuales y ajustes comunes.

## 13. Despliegue y ambientes

### Desarrollo local

```bash
cd frontend
npm install
npm run dev
```

URL habitual: `http://localhost:3000`.

El backend debe estar disponible en `http://localhost:4000`.

### Producción

El frontend está preparado para Vercel. El backend es independiente y se configura mediante variables de entorno en Render u otra plataforma.

Variables relevantes del frontend:

```env
NEXT_PUBLIC_API_BASE_URL
NEXT_PUBLIC_BACKEND_URL
NEXT_PUBLIC_WS_URL
NEXT_PUBLIC_ENABLE_WS_LOCAL
```

Regla operativa importante: modificar el código local no cambia Vercel ni Render hasta ejecutar el flujo de despliegue correspondiente.

## 14. Scripts

```bash
npm run dev       # desarrollo con Next.js/Webpack
npm run build     # build de producción
npm run start     # arranque del build producido
npm run lint      # ESLint
npx tsc --noEmit  # validación de tipos
```

## 15. Calidad y deuda técnica observada

El tipado de TypeScript está configurado como estricto y el proyecto compila correctamente en la validación de tipos. Sin embargo, ESLint reporta problemas existentes, entre ellos:

- Uso de `any` en algunos módulos.
- Dependencias faltantes en `useEffect`/`useMemo`.
- Variables sin uso.
- Algunos patrones de estado dentro de efectos.
- Advertencias por imágenes `<img>` sin `next/image`.

También convendría:

1. Separar páginas grandes en componentes y hooks por dominio.
2. Centralizar tipos de respuestas API.
3. Unificar proxy/rewrite para evitar dos estrategias de enrutamiento.
4. Incorporar React Query/SWR para caché e invalidación declarativa.
5. Añadir pruebas unitarias y pruebas de flujo para formularios críticos.
6. Añadir pruebas end-to-end para login, reservas, aprobación y correos.
7. Migrar tokens desde `localStorage` a cookies `HttpOnly`.
8. Añadir un identificador de correlación para seguir una petición desde navegador, proxy, backend y proveedor de correo.
9. Configurar `metadataBase` y agregar `public/manifest.json` si se desea eliminar las advertencias actuales.
10. Documentar explícitamente las variables de entorno de Vercel, Render y desarrollo local.

## 16. Recomendaciones para el equipo de TI

- Mantener frontend y backend como despliegues independientes, con versiones identificables.
- Registrar commit, fecha y variables de entorno no secretas en cada despliegue.
- No colocar claves secretas en variables `NEXT_PUBLIC_*`.
- Centralizar logs con request ID.
- Monitorizar errores 4xx/5xx y tiempos de respuesta del proxy.
- Configurar alertas para caída del backend, WebSocket y proveedor de correo.
- Mantener una matriz de permisos por rol y probarla en cada cambio.
- Usar una cuenta de prueba por ambiente para validar reservas y correos.
- No utilizar la caché del navegador como mecanismo de consistencia.

## 17. Diagnóstico rápido de conectividad

Para comprobar el backend local:

```bash
curl -i http://localhost:4000/api/health
```

Para comprobar el frontend local:

```text
http://localhost:3000
```

Si la página se abre desde `https://administracion-bolivar-rave.vercel.app`, las peticiones se ejecutan contra el entorno desplegado y sus logs deben revisarse en Vercel/Render, no en las terminales locales.
