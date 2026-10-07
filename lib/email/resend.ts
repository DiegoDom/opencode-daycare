import { Resend } from "resend";

// El cliente se crea bajo demanda: un build o un request que no envíe correo no
// debe romper por faltar la clave. RESEND_API_KEY es server-only.
export function resend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Falta RESEND_API_KEY en el entorno.");
  }

  return new Resend(apiKey);
}

export const RESEND_FROM =
  process.env.RESEND_FROM ?? "OpenDayCare <onboarding@resend.dev>";

// Base del enlace de activación, solo para el correo en el servidor (sin
// NEXT_PUBLIC_). En local default a la app; en prod, el dominio propio.
export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";