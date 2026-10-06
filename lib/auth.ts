import { cache } from "react";

import { createClient } from "@/data/supabase/server";

export type UserRole = "staff" | "parent" | "admin";

export type UserStatus = "pending" | "active";

export interface SessionUser {
  id: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  daycareId: string;
  daycareName: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  staff: "Maestra",
  parent: "Familia",
  admin: "Directora",
};

export function initialsFrom(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

export function shortDaycareName(daycareName: string): string {
  return daycareName.replace(/^Guardería\s+/i, "").trim().toUpperCase();
}

// Solo un path relativo del propio sitio: `//host` y `https://host` son
// open redirects con la marca de la app arriba.
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "invalid-credentials" | "unexpected" };

interface UserProfileRow {
  id: string;
  full_name: string;
  role: string;
  status: string;
  daycare_id: string;
  daycares: { name: string } | null;
}

// El layout y la página lo llaman en el mismo request: sin `cache()` son dos
// consultas idénticas a `public.users` por navegación.
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();

  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const subject = claims?.claims?.sub;
  if (claimsError || !subject) return null;

  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role, status, daycare_id, daycares(name)")
    .eq("id", subject)
    .maybeSingle();

  if (error || !data) return null;

  // El cliente no lleva el tipo `Database`, así que infiere el embed como array;
  // PostgREST devuelve un objeto porque `users.daycare_id` es un FK a una PK.
  const profile = data as unknown as UserProfileRow;

  return {
    id: profile.id,
    fullName: profile.full_name,
    role: profile.role as UserRole,
    status: profile.status as UserStatus,
    daycareId: profile.daycare_id,
    // `daycares_select_own` exige `status = 'active'`, así que para un
    // `pending` el embed resuelve `null`.
    daycareName: profile.daycares?.name ?? "",
  };
});

export async function signIn(email: string, password: string): Promise<SignInResult> {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (!error) return { ok: true };
  // GoTrue responde 400 `invalid_credentials` tanto si el email no existe como
  // si la contraseña no coincide: los dos casos son el mismo `reason`.
  if (error.status === 400 || error.code === "invalid_credentials") {
    return { ok: false, reason: "invalid-credentials" };
  }
  return { ok: false, reason: "unexpected" };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
