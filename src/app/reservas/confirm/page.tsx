"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function ConfirmReservationContent() {
  const searchParams = useSearchParams();
  const reservationId = searchParams.get("reservationId");
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [reservation, setReservation] = useState<any>(null);

  useEffect(() => {
    if (!reservationId || !token) {
      setStatus("error");
      setMessage("Parámetros de confirmación inválidos o ausentes.");
      return;
    }

    const confirm = async () => {
      try {
        // Call the backend confirm endpoint via the proxy; request JSON response
        const resp = await fetch(`/api/reservas/${reservationId}/confirm?token=${encodeURIComponent(token)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });

        if (!resp.ok) {
          const body = await resp.json().catch(() => null);
          const errorText = (body && body.error) || `Error en la confirmación (${resp.status})`;

          // If the server indicates the reservation was already confirmed,
          // treat it as a successful outcome (idempotent) and show a friendly message.
          if (String(errorText).toLowerCase().includes("ya fue confirmada") || String(errorText).toLowerCase().includes("ya estaba confirmada") || resp.status === 409) {
            setStatus("success");
            setMessage(errorText);
            return;
          }

          setStatus("error");
          setMessage(errorText);
          return;
        }

        const body = await resp.json();
        setReservation(body.reservation || null);
        setMessage(body.message || "Reserva confirmada");
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setMessage("No fue posible conectar con el servidor de confirmación.");
      }
    };

    confirm();
  }, [reservationId, token]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full space-y-6 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eff3] animate-pulse">
                <span className="material-symbols-outlined text-[#3a5f94] animate-spin">hourglass_top</span>
              </div>
            </div>
            <h1 className="text-2xl font-black text-[#2a3439]">Confirmando tu reserva...</h1>
            <p className="text-sm text-slate-600">Por favor espera mientras procesamos tu solicitud.</p>
          </div>
        )}

        {status === "success" && (
          reservation ? (
          <div className="rounded-2xl border border-[#e6eef7] bg-white p-8 shadow-lg">
            <div className="flex items-center justify-center gap-4">
              <img src="/logo.png" alt="UNAC Bolivar Logo" className="h-14 w-14 rounded-lg bg-white p-1" />
              <div className="text-left">
                <div className="text-xs font-bold uppercase text-slate-500">UNAC</div>
                <div className="text-lg font-extrabold text-[#295786]">Administración del Edificio Bolivar Rave</div>
              </div>
            </div>

            <div className="mt-6 text-center">
              <div className="inline-flex items-center justify-center rounded-full bg-emerald-50 p-3">
                <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
              </div>
              <h1 className="mt-4 text-3xl font-black text-[#1f2937]">¡Reserva Confirmada!</h1>
              <p className="mt-2 text-sm text-slate-600">{message}</p>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[#e6eef7] bg-[#fbfdff] p-4">
                <div className="text-xs font-bold uppercase text-slate-500">Espacio / Equipo</div>
                <div className="mt-1 font-semibold text-[#0f1724]">{reservation.resourceLabel}</div>
              </div>
              <div className="rounded-xl border border-[#e6eef7] bg-[#fbfdff] p-4">
                <div className="text-xs font-bold uppercase text-slate-500">Motivo</div>
                <div className="mt-1 font-semibold text-[#0f1724]">{reservation.purpose}</div>
              </div>
              <div className="rounded-xl border border-[#e6eef7] bg-[#fbfdff] p-4">
                <div className="text-xs font-bold uppercase text-slate-500">Fecha</div>
                <div className="mt-1 font-semibold text-[#0f1724]">{reservation.bookingDate}</div>
              </div>
              <div className="rounded-xl border border-[#e6eef7] bg-[#fbfdff] p-4">
                <div className="text-xs font-bold uppercase text-slate-500">Horario</div>
                <div className="mt-1 font-semibold text-[#0f1724]">{reservation.startTime} - {reservation.endTime}</div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#fdecea] bg-[#fff7f7] p-4">
              <div className="text-sm font-bold text-[#9f403d]">Importante</div>
              <div className="mt-2 text-sm text-slate-700">Debe devolverlo en buen estado y cumplir el horario confirmado. El incumplimiento o cualquier daño reportado podrá generar penalizaciones administrativas.</div>
            </div>

            
          </div>
          ) : (
            <div className="rounded-2xl border border-[#e6eef7] bg-white p-8 shadow-lg">
              <div className="flex items-center justify-center gap-4">
                <img src="/logo.png" alt="UNAC Bolivar Logo" className="h-14 w-14 rounded-lg bg-white p-1" />
                <div className="text-left">
                  <div className="text-xs font-bold uppercase text-slate-500">UNAC</div>
                  <div className="text-lg font-extrabold text-[#295786]">Administración del Edificio Bolivar Rave</div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <div className="inline-flex items-center justify-center rounded-full bg-emerald-50 p-3">
                  <span className="material-symbols-outlined text-3xl text-emerald-600">check_circle</span>
                </div>
                <h1 className="mt-4 text-3xl font-black text-[#1f2937]">¡Reserva Confirmada!</h1>
                <p className="mt-2 text-sm text-slate-600">{message}</p>
              </div>

              
            </div>
          )
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
                <span className="material-symbols-outlined text-2xl text-rose-600">error</span>
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#2a3439]">Error en la Confirmación</h1>
              <p className="mt-2 text-sm text-slate-600">{message}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfirmReservationFallback() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="w-full space-y-6 text-center">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eff3] animate-pulse">
              <span className="material-symbols-outlined text-[#3a5f94] animate-spin">hourglass_top</span>
            </div>
          </div>
          <h1 className="text-2xl font-black text-[#2a3439]">Confirmando tu reserva...</h1>
          <p className="text-sm text-slate-600">Por favor espera mientras procesamos tu solicitud.</p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmReservationPage() {
  return (
    <Suspense fallback={<ConfirmReservationFallback />}>
      <ConfirmReservationContent />
    </Suspense>
  );
}
