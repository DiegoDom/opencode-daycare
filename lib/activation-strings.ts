// Strings de la UI de activación, extraídos del formulario para no duplicarlos
// entre el mockup, el formulario y el correo (SPEC 14). Solo valores: sin lógica.

export interface ActivationFieldStrings {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
}

export const activateLabels = {
  title: "Bienvenida a OpenDayCare",
  step1Subtitle:
    "Te invitaron a seguir el día de tu hijo. Ingresá tu email para recibir el código de verificación.",
  step2Subtitle: "Te invitaron a seguir el día de tu hijo. Creá tu contraseña para activar la cuenta.",
  invitedBy: "Te invitaron a seguir a",
  codeLabel: "CÓDIGO DE INVITACIÓN",
  emailLabel: "EMAIL",
  passwordLabel: "CREAR CONTRASEÑA",
  confirmationLabel: "CONFIRMAR CONTRASEÑA",
  agreement:
    "Autorizo a la guardería a tomar y compartir fotos de mi hijo dentro de la app.",
  step1Cta: "Enviarme el código de verificación",
  step2Cta: "Activar mi cuenta",
  resendHint:
    "¿No recibiste el correo? Revisá la casilla o volvé a enviar el código.",
  alreadyAccount: "¿Ya tenés cuenta?",
  login: "Iniciar sesión",
  clearCode: "Borrar el código prefijado para escribir uno nuevo",
  removalIndicator: "Quitar",
} as const;

// Iniciales y nombre corto de la guardería para la card del invitado. Mismo
// cálculo que en `lib/auth`, pero sin arrastrar el cliente de Supabase a los
// Client Components (`components/` jamás importa `data/`).
export function activationInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0] ?? "")
    .join("")
    .toUpperCase();
}

export function activationDaycareShort(name: string): string {
  return name.replace(/^Guardería\s+/i, "").trim().toUpperCase();
}

export const activateInputs = {
  code: {
    label: activateLabels.codeLabel,
    name: "code",
    autoComplete: "one-time-code",
  } satisfies ActivationFieldStrings,
  email: {
    label: activateLabels.emailLabel,
    name: "email",
    type: "email",
    autoComplete: "email",
    placeholder: "nombre@guarderia.com",
  } satisfies ActivationFieldStrings,
  password: {
    label: activateLabels.passwordLabel,
    name: "password",
    type: "password",
    autoComplete: "new-password",
  } satisfies ActivationFieldStrings,
  confirmation: {
    label: activateLabels.confirmationLabel,
    name: "confirmation",
    type: "password",
    autoComplete: "new-password",
  } satisfies ActivationFieldStrings,
} as const;