"use server";

import { redirect } from "next/navigation";

import { safeRedirectPath, signIn, signOut, type SignInResult } from "@/lib/auth";

export interface LoginState {
  fieldErrors?: { email?: string; password?: string };
  error?: string;
}

type SignInReason = Extract<SignInResult, { ok: false }>["reason"];

const SIGN_IN_MESSAGES: Record<SignInReason, string> = {
  // Neutro a propósito: distinguir "no existe" de "contraseña mal" convierte el
  // login en un enumerador de emails.
  "invalid-credentials": "Email o contraseña incorrectos",
  unexpected: "No pudimos iniciar sesión. Intentá de nuevo.",
};

export async function loginAction(prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(String(formData.get("next") ?? ""));

  const fieldErrors: NonNullable<LoginState["fieldErrors"]> = {};
  if (!email) fieldErrors.email = "Ingresá tu email.";
  if (!password) fieldErrors.password = "Ingresá tu contraseña.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  let result: SignInResult;
  try {
    result = await signIn(email, password);
  } catch {
    result = { ok: false, reason: "unexpected" };
  }
  if (!result.ok) return { error: SIGN_IN_MESSAGES[result.reason] };

  // Fuera del `try`: adentro, `redirect()` se traga como un error de red.
  redirect(next);
}

export async function logoutAction(): Promise<void> {
  await signOut();
  redirect("/login");
}