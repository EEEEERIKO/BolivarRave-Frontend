import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export interface UseWebSocketSchedulesOptions {
  onScheduleRefresh?: () => void;
  onScheduleChange?: (eventId?: string, slotId?: string) => void;
  enabled?: boolean;
}

export const useWebSocketSchedules = ({
  onScheduleRefresh,
  onScheduleChange,
  enabled = true,
}: UseWebSocketSchedulesOptions = {}) => {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const connectionAttemptRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const isLocalDev =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168"));
    const enableLocalWs = (process.env.NEXT_PUBLIC_ENABLE_WS_LOCAL ?? "").trim().toLowerCase() === "true";

    if (isLocalDev && !enableLocalWs) {
      return;
    }

    // Detectar la URL del servidor basándose en el ambiente
    const getServerUrl = () => {
      if (typeof window === "undefined") return "http://localhost:4000";

      const wsFromEnv = (process.env.NEXT_PUBLIC_WS_URL ?? "").trim();
      if (wsFromEnv) {
        console.log("[WebSocket] Usando WS desde NEXT_PUBLIC_WS_URL:", wsFromEnv);
        return wsFromEnv;
      }

      const fromEnv = (process.env.NEXT_PUBLIC_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim();
      if (fromEnv) {
        console.log("[WebSocket] Usando backend desde variable de entorno:", fromEnv);
        return fromEnv;
      }

      const devUrl = "http://localhost:4000";

      // En desarrollo local (localhost o 127.0.0.1)
      const isLocalhost =
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168");

      if (isLocalhost) {
        console.log("[WebSocket] Detectado environment local, usando:", devUrl);
        return devUrl;
      }

      // En producción, usar mismo host/origen por defecto (con proxy/rewrite)
      const productionUrl = window.location.origin;
      console.log("[WebSocket] Detectado environment producción, usando:", productionUrl);
      return productionUrl;
    };

    const serverUrl = getServerUrl();

    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      // En local usamos polling para evitar ruido de "WebSocket closed before established".
      transports: isLocalDev ? ["polling"] : ["polling", "websocket"],
      forceNew: false,
      upgrade: !isLocalDev,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ [WebSocket] Conectado al servidor", socket.id);
      isConnectedRef.current = true;
      connectionAttemptRef.current = 0;
      socket.emit("subscribe:schedules");
      console.log("📨 [WebSocket] Subscrito a canal: schedules");
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ [WebSocket] Desconectado. Razón:", reason);
      isConnectedRef.current = false;
    });

    socket.on("connect_error", (error) => {
      connectionAttemptRef.current++;
      console.warn(
        `⚠️ [WebSocket] Error en conexión (intento ${connectionAttemptRef.current}):`,
        error.message
      );
    });

    socket.on("schedule:refresh", () => {
      console.log("📡 [WebSocket] Recibido evento 'schedule:refresh'");

      // Limpiar caché para forzar recarga de datos
      if (typeof window !== "undefined") {
        localStorage.removeItem("schedules-page-cache-v1");
        console.log("🧹 Cache limpiado");
      }

      // Notificar al componente
      console.log("🔄 Sincronizando datos desde la API...");
      onScheduleRefresh?.();
    });

    socket.on("schedule:changed", (event: { eventId?: string; slotId?: string }) => {
      console.log("📡 [WebSocket] Recibido evento 'schedule:changed':", event);

      // Limpiar caché
      if (typeof window !== "undefined") {
        localStorage.removeItem("schedules-page-cache-v1");
        console.log("🧹 Cache limpiado");
      }

      // Notificar al componente
      console.log("🔄 Sincronizando cambio específico...");
      onScheduleChange?.(event.eventId, event.slotId);
    });

    // Logs de debugging
    socket.on("error", (error) => {
      console.error("🔴 [WebSocket] Error grave:", error);
    });

    socket.onAny((event, ...args) => {
      // Log todos los eventos excepto los muy frecuentes
      if (!["connect", "disconnect"].includes(event)) {
        console.debug(`[WebSocket] Evento recibido: ${event}`, args);
      }
    });

    return () => {
      console.log("🔌 [WebSocket] Desuscribiendo y desconectando...");
      socket.emit("unsubscribe:schedules");
      socket.disconnect();
    };
  }, [enabled, onScheduleRefresh, onScheduleChange]);

  return {
    isConnectedRef,
    socketRef,
  };
};
