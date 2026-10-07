"use server";

import { createClient } from "@/data/supabase/admin";
import { getActivationInvitation } from "@/lib/activate";
import { activationLink, renderInvitationEmail } from "@/lib/email/invitation";
import { RESEND_FROM, resend } from "@/lib/email/resend";
import { generateInviteCode, hashInviteCode } from "@/lib/invite-code";
import { validateParentEmail } from "@/lib/kid-validation";

// El nombre sale de la spec (`VerifyEmialActionState`); se conserva tal cual
// para que el contrato de la spec y el código coincidan.
export type VerifyEmialActionState = {
  ok: boolean;
  error?: string;
  email?: string;
};

// La BD solo guarda el hash, así que "reenviar" significa emitir un código
// nuevo: se regenera `code_hash` y se extiende la vigencia 7 días (mismo
// precedente que reinvitar en SPEC 13) y recién después se envía el correo.
async function resendVerificationEmail({ email }: { email: string }): Promise<{ error?: string }> {
  const invitation = await getActivationInvitation(email);
  if (!invitation) {
    return { error: "No encontramos una invitación pendiente para este email." };
  }

  const code = generateInviteCode();
  const codeHash = hashInviteCode(code);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createClient();
  const { error: updateError } = await admin
    .from("invitations")
    .update({ code_hash: codeHash, expires_at: expiresAt })
    .eq("id", invitation.id)
    .eq("status", "pending");
  if (updateError) {
    console.error("[resendVerificationEmail] update:", updateError.message, updateError.code);
    return { error: "No pudimos preparar el correo. Intentá de nuevo." };
  }

  const { subject, html } = renderInvitationEmail({
    parentName: invitation.fullName,
    childName: invitation.childName,
    daycareName: invitation.daycareName,
    code,
    link: activationLink(code, email),
  });

  try {
    const { error: sendError } = await resend().emails.send({
      from: RESEND_FROM,
      to: email,
      subject,
      html,
    });
    if (sendError) {
      console.error("[resendVerificationEmail] resend:", sendError.message);
      return { error: "No pudimos enviar el correo. Intentá de nuevo." };
    }
  } catch (sendError) {
    console.error("[resendVerificationEmail] resend threw:", sendError);
    return { error: "No pudimos enviar el correo. Intentá de nuevo." };
  }

  return {};
}

export async function verifyActivationEmail(
  state: VerifyEmialActionState,
  formData: FormData,
): Promise<VerifyEmialActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const emailError = validateParentEmail(email);
  if (emailError) return { ok: false, error: emailError };

  try {
    const result = await resendVerificationEmail({ email });
    if (result.error) return { ok: false, error: result.error };
  } catch (error) {
    console.error("[verifyActivationEmail]", error);
    return { ok: false, error: "No pudimos verificar tu email. Intentá de nuevo." };
  }

  return { ok: true, email };
}
