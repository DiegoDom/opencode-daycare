import { createClient } from "@/data/supabase/server";
import type { KidParent, ParentRole } from "@/lib/kids";

type Relationship = "mama" | "papa" | "tutor";
type InvitationStatus = "pending" | "accepted" | "revoked";

const ROLE_LABELS: Record<Relationship, ParentRole> = {
  mama: "Mamá",
  papa: "Papá",
  tutor: "Tutor/a",
};

// Misma PALETTE de `lib/kids.ts`: la BD no guarda colores, el índice sale de un
// hash determinista del id de la fila (el id de la invitación).
const PALETTE = [
  { avatarBg: "#F4B8CC", avatarColor: "#C44A7A" },
  { avatarBg: "#A9D9E8", avatarColor: "#1F7A93" },
  { avatarBg: "#B9DEC4", avatarColor: "#3E8B62" },
  { avatarBg: "#F4DC8E", avatarColor: "#9A7B1E" },
  { avatarBg: "#C9B6E8", avatarColor: "#7B5FC0" },
];

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

function paletteIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTE.length;
}

interface InvitationRow {
  id: string;
  full_name: string;
  relationship: Relationship;
  status: InvitationStatus;
}

// Padres visibles para la card de `/kids/[id]`: SÍ se leen `invitations` en
// ambos estados porque la fila guarda `full_name` y el RLS de staff la expone.
// NO se hace el embed `parent_children -> users`: `users_select_own` oculta el
// nombre de otros usuarios a un staff, así que ese nombre saldría `null`.
// Pendientes + aceptadas = lo que muestra la card (y la cuenta de activos para
// el límite de 3). `revoked` no aparece y no suma al límite.
export async function getKidParents(childId: string): Promise<KidParent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("invitations")
    .select("id, full_name, relationship, status")
    .eq("child_id", childId)
    .in("status", ["pending", "accepted"])
    .order("created_at");

  if (error) {
    console.error("[getKidParents] invitations:", error.message, error.code);
    throw new Error(`getKidParents: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as InvitationRow[];
  return rows.map((row) => {
    const name = row.full_name;
    const avatar = PALETTE[paletteIndex(row.id)];
    const accepted = row.status === "accepted";

    return {
      name,
      initials: initialsOf(name),
      avatarBg: avatar.avatarBg,
      avatarColor: avatar.avatarColor,
      role: ROLE_LABELS[row.relationship],
      status: accepted ? "activa" : "invitación enviada",
      statusLabel: accepted ? "ACTIVA" : "PENDIENTE",
    };
  });
}