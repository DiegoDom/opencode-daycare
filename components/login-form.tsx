"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { loginAction, type LoginState } from "@/lib/auth-actions";

const INITIAL_STATE: LoginState = {};

export default function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL_STATE);
  // El email se controla solo para prefillar el paso 1 de activación con el
  // email que escribió el que está por loguear ("no recibí el correo").
  const [email, setEmail] = useState("");

  const activationHref = `/activate-account${
    email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""
  }`;

  return (
    <form action={formAction} noValidate>
      <h2 className="mb-[6px] font-display text-[30px] font-semibold text-ink">
        Iniciar sesión
      </h2>
      <p className="mb-7 text-[15px] text-muted">Ingresá para ver el día de hoy.</p>

      <input type="hidden" name="next" value={next} />

      <div className="mb-[9px] text-[12px] font-bold tracking-[0.7px] text-muted">
        EMAIL
      </div>
      <input
        name="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="nombre@guarderia.com"
        aria-label="Correo electrónico"
        aria-invalid={state.fieldErrors?.email ? true : undefined}
        className={`w-full rounded-[14px] border-[1.5px] bg-white px-4 py-[14px] text-[15px] text-ink placeholder:text-[#B6A99B] ${
          state.fieldErrors?.email
            ? "mb-[6px] border-terracotta"
            : "mb-[18px] border-[#EADFD0]"
        }`}
      />
      {state.fieldErrors?.email && (
        <p role="alert" className="mb-[14px] text-[13px] font-semibold text-terracotta-deep">
          {state.fieldErrors.email}
        </p>
      )}

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        CONTRASEÑA
      </div>
      <input
        name="password"
        type="password"
        required
        placeholder="••••••••"
        aria-label="Contraseña"
        aria-invalid={state.fieldErrors?.password ? true : undefined}
        className={`w-full rounded-[14px] border-[1.5px] bg-white px-4 py-[14px] text-[15px] text-ink placeholder:text-[#B6A99B] ${
          state.fieldErrors?.password
            ? "mb-[6px] border-terracotta"
            : "mb-[10px] border-[#EADFD0]"
        }`}
      />
      {state.fieldErrors?.password && (
        <p role="alert" className="mb-[12px] text-[13px] font-semibold text-terracotta-deep">
          {state.fieldErrors.password}
        </p>
      )}

      <div className={state.error ? "mb-[14px] text-right" : "mb-5 text-right"}>
        <button
          type="button"
          className="cursor-pointer text-[13.5px] font-bold text-terracotta-deep"
        >
          ¿Olvidaste tu contraseña?
        </button>
      </div>

      {state.error && (
        <p
          role="alert"
          className="mb-4 rounded-[12px] bg-badge-coral-bg px-4 py-[11px] text-[13.5px] font-semibold text-badge-coral"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="block w-full cursor-pointer rounded-[15px] bg-gradient-to-b from-peach to-coral py-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)] disabled:cursor-progress disabled:opacity-70"
      >
        Iniciar sesión
      </button>

      <p className="mt-3 text-center text-[14px] text-muted">
        ¿No recibiste el correo de activación?{" "}
        <Link
          href={activationHref}
          className="cursor-pointer font-extrabold text-terracotta-deep"
        >
          Reenviar el código
        </Link>
      </p>

      <p className="mt-6 text-center text-[14.5px] text-muted">
        ¿Te invitó la guardería?{" "}
        <Link
          href="/activate-account"
          className="cursor-pointer font-extrabold text-terracotta-deep"
        >
          Activá tu cuenta
        </Link>
      </p>
    </form>
  );
}