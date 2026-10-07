import { createClient } from "@/data/supabase/admin";
import { hashInviteCode, timingSafeEqual } from "@/lib/invite-code";

export type InvitationRelationship = "mama" | "papa" | "tutor";

export interface PrefilledValues {
  code?: string;
  email?: string;
}

export type ActivationView = "enter-email" | "create-account";

// Una fila de `invitations` ya resuelta para la activación (niño + guardería
// para la plantilla del correo). `fullName` no está en el contrato mínimo de la
// spec: es el nombre del padre invitado, con el que la plantilla saluda.
export interface InvitationScan {
  id: string;
  fullName: string;
  childName: string;
  daycareName: string;
  codeHash: string;
  relationship: InvitationRelationship;
}

interface ActivationInvitationRow {
  id: string;
  full_name: string;
  code_hash: string;
  relationship: InvitationRelationship;
  children: { full_name: string } | { full_name: string }[] | null;
  daycares: { name: string } | { name: string }[] | null;
}

// El RLS de `invitations` es solo para staff/admin, así que la lectura corre con
// el cliente Admin (`service_role`): el padre que llega a `/activate-account`
// todavía no tiene cuenta ni sesión.
export async function getActivationInvitation(email: string): Promise<InvitationScan | null> {
  const admin = createClient();
  const normalized = email.trim().toLowerCase();

  // "Más reciente": el reenvío regenera el código en la misma fila, así que
  // manda `updated_at`, no `created_at`.
  const { data, error } = await admin
    .from("invitations")
    .select(
      "id, full_name, code_hash, relationship, children(full_name), daycares(name)",
    )
    .eq("email", normalized)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("[getActivationInvitation] invitations:", error.message, error.code);
    throw new Error(`getActivationInvitation: ${error.message}`);
  }

  const row = (data?.[0] ?? null) as ActivationInvitationRow | null;
  if (!row) return null;

  const child = Array.isArray(row.children) ? row.children[0] : row.children;
  const daycare = Array.isArray(row.daycares) ? row.daycares[0] : row.daycares;
  if (!child || !daycare) return null;

  return {
    id: row.id,
    fullName: row.full_name,
    childName: child.full_name,
    daycareName: daycare.name,
    codeHash: row.code_hash,
    relationship: row.relationship,
  };
}

// La BD solo guarda el hash del código, así que el lookup no puede comparar el
// texto plano: se trae por prefijo de 6 chars del `sha256(candidato)` (grep por
// `invitations_code_hash_idx`) y se confirma sobre el hash completo con
// `timingSafeEqual`. Devuelve todas las invitaciones pendientes y no vencidas
// del email cuyo hash coincide — normalmente una.
export async function lookupInvitationByCodePrefix(
  code: string,
  email: string,
): Promise<InvitationScan[]> {
  const admin = createClient();
  const normalized = email.trim().toLowerCase();
  const candidateHash = hashInviteCode(code);
  const prefix = candidateHash.slice(0, 6);

  const { data, error } = await admin
    .from("invitations")
    .select("id, full_name, code_hash, relationship, children(full_name), daycares(name)")
    .eq("email", normalized)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .like("code_hash", `${prefix}%`);

  if (error) {
    console.error("[lookupInvitationByCodePrefix] invitations:", error.message, error.code);
    throw new Error(`lookupInvitationByCodePrefix: ${error.message}`);
  }

  const rows = (data ?? []) as ActivationInvitationRow[];
  const candidateBytes = new Uint8Array(Buffer.from(candidateHash, "hex"));

  const scanned: InvitationScan[] = [];
  for (const row of rows) {
    const storedBytes = new Uint8Array(Buffer.from(row.code_hash, "hex"));
    if (!timingSafeEqual(candidateBytes, storedBytes)) continue;

    const child = Array.isArray(row.children) ? row.children[0] : row.children;
    const daycare = Array.isArray(row.daycares) ? row.daycares[0] : row.daycares;
    if (!child || !daycare) continue;

    scanned.push({
      id: row.id,
      fullName: row.full_name,
      childName: child.full_name,
      daycareName: daycare.name,
      codeHash: row.code_hash,
      relationship: row.relationship,
    });
  }

  return scanned;
}
