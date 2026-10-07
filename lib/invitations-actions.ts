"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/data/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { renderInvitationEmail } from "@/lib/email/invitation";
import { APP_URL, RESEND_FROM, resend } from "@/lib/email/resend";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { validateParentEmail, validateParentName } from "@/lib/kid-validation";
import type { ParentRole } from "@/lib/kids";

const ROLE_TO_DB: Record<ParentRole, "mama" | "papa" | "tutor"> = {
  Mamá: "mama",
  Papá: "papa",
  "Tutor/a": "tutor",
};

export interface InviteParentDraft {
  childId: string;
  name: string;
  email: string;
  role: ParentRole;
}

export interface InviteParentState {
  code?: string;
  error?: string;
}

function expiresAt(): string {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function inviteParentAction(
  draft: InviteParentDraft,
): Promise<InviteParentState> {
  const name = draft.name.trim();
  const email = draft.email.trim().toLowerCase();
  const nameError = validateParentName(name);
  if (nameError) return { error: nameError };
  const emailError = validateParentEmail(email);
  if (emailError) return { error: emailError };

  const user = await getCurrentUser();
  if (!user || user.status !== "active" || user.role === "parent") {
    return { error: "No tenés permiso para invitar padres." };
  }

  const supabase = await createClient();

  // El RLS scoping por guardería lo aplica la política sobre `children`: si la
  // sesión no tiene un staff/admin activo de la guardería del niño, no llega.
  const { data: child, error: childError } = await supabase
    .from("children")
    .select("id, daycare_id, full_name")
    .eq("id", draft.childId)
    .maybeSingle();
  if (childError || !child) {
    return { error: "No encontramos el niño. Elegí uno válido." };
  }

  const code = generateInviteCode();
  const codeHash = hashInviteCode(code);
  const relationship = ROLE_TO_DB[draft.role];

  // Upsert "update-then-insert" sobre el índice único parcial
  // `(child_id, email) where status = 'pending'`: reinvitar regenera el código
  // y extiende la vigencia en la misma fila; un email nuevo inserta.
  const { data: updated } = await supabase
    .from("invitations")
    .update({
      full_name: name,
      relationship,
      code_hash: codeHash,
      expires_at: expiresAt(),
      invited_by: user.id,
    })
    .eq("child_id", child.id)
    .eq("email", email)
    .eq("status", "pending")
    .select("id");

  const neededInsert = !updated || updated.length === 0;
  if (neededInsert) {
    const { error: insertError } = await supabase.from("invitations").insert({
      daycare_id: child.daycare_id,
      child_id: child.id,
      email,
      full_name: name,
      relationship,
      code_hash: codeHash,
      status: "pending",
      expires_at: expiresAt(),
      invited_by: user.id,
    });
    if (insertError) {
      // El índice único parcial es la red ante la carrera; el reintento resuelve.
      console.error("[inviteParentAction] insert:", insertError.message, insertError.code);
      return { error: "No pudimos guardar la invitación. Intentá de nuevo." };
    }
  }

  const { subject, html } = renderInvitationEmail({
    parentName: name,
    childName: child.full_name,
    daycareName: user.daycareName,
    code,
    link: `${APP_URL}/activate-account?code=${encodeURIComponent(code)}`,
  });

  try {
    const { error: sendError } = await resend().emails.send({
      from: RESEND_FROM,
      to: email,
      subject,
      html,
    });
    if (sendError) {
      console.error("[inviteParentAction] resend:", sendError.message);
      return { error: "No pudimos enviar el correo. La invitación quedó guardada; intentalo de nuevo." };
    }
  } catch (sendError) {
    console.error("[inviteParentAction] resend threw:", sendError);
    return { error: "No pudimos enviar el correo. La invitación quedó guardada; intentalo de nuevo." };
  }

  revalidatePath(`/kids/${draft.childId}`);
  return { code };
}