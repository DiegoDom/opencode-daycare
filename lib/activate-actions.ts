"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/data/supabase/admin";
import {
  assertParentProfile,
  getActivationInvitation,
  isPasswordValidAndConfirmed,
  lookupInvitationByCodePrefix,
  type ParentProfile,
} from "@/lib/activate";
import { signIn } from "@/lib/auth";
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

export type CreateParentAccountState = { error?: string };

const CODE_ERROR = "El código es inválido, vencido o ya fue utilizado.";
const GENERIC_ERROR = "No pudimos procesar tu solicitud. Intentá de nuevo.";
const PASSWORD_ERROR =
  "La contraseña debe tener al menos 8 caracteres y coincidir con su confirmación.";

export async function createParentAccountAction(
  state: CreateParentAccountState,
  formData: FormData,
): Promise<CreateParentAccountState> {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  let invitation: Awaited<ReturnType<typeof lookupInvitationByCodePrefix>>[number];
  try {
    const invitations = await lookupInvitationByCodePrefix(code, email);
    const first = invitations[0];
    if (!first) return { error: CODE_ERROR };
    invitation = first;
  } catch (error) {
    console.error("[createParentAccountAction] lookup:", error);
    return { error: GENERIC_ERROR };
  }

  let profile: ParentProfile;
  try {
    profile = { name: invitation.fullName, email, password };
    assertParentProfile(profile);
  } catch (error) {
    return { error: error instanceof Error ? error.message : GENERIC_ERROR };
  }

  if (!isPasswordValidAndConfirmed(password, confirmation)) {
    return { error: PASSWORD_ERROR };
  }

  const admin = createClient();

  // El `app_metadata` lo escribe el servidor: `role`, `status` y `daycare_id`
  // son datos de autorización, nunca decididos desde el navegador. El email y el
  // nombre no se confirman solos: `email_confirm: true` crea la cuenta lista
  // para entrar; la activación la autoriza `activate_invitation`, no el email.
  const { data, error: signUpError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: profile.name },
    app_metadata: { role: "parent", status: "pending", daycare_id: invitation.daycareId },
  });

  if (signUpError) {
    const alreadyRegistered =
      signUpError.code === "email_exists" || /already been registered/i.test(signUpError.message);
    if (alreadyRegistered) {
      return { error: "Este email ya está registrado — iniciá sesión." };
    }
    console.error("[createParentAccountAction] createUser:", signUpError.message, signUpError.code);
    return { error: "No pudimos crear tu cuenta. Intentá de nuevo." };
  }

  // Promueve a `active`, vincula `parent_children` y acepta la invitación, todo
  // en una transacción (SPEC 13). Si la invitación se usó entre el lookup y acá,
  // la carrera la resuelve `activate_invitation` con status/check de vigencia.
  const { error: activateError } = await admin.rpc("activate_invitation", {
    p_user_id: data.user.id,
    p_invitation_id: invitation.id,
  });
  if (activateError) {
    console.error(
      "[createParentAccountAction] activate_invitation:",
      activateError.message,
      activateError.code,
    );
    return { error: CODE_ERROR };
  }

  // Auto-login: la cuenta recién creada entra sola; el `signIn` (cliente de
  // servidor) escribe la cookie de sesión y `redirect` la lleva a `/`.
  const result = await signIn(email, password);
  if (!result.ok) {
    return { error: "Cuenta creada, pero no pudimos iniciar sesión. Entrá desde el login." };
  }

  redirect("/");
}
