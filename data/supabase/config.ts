const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Falta ${name} en el entorno. Verificá .env.local y .env.example.`);
  }

  return value;
}

export const SUPABASE_URL = required(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL");
export const SUPABASE_PUBLISHABLE_KEY = required(
  supabasePublishableKey,
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
);

export function getSupabaseUrl(): string {
  return SUPABASE_URL;
}

// La secret key (service_role) solo se resuelve al construir el cliente Admin:
// un build o un request que no toque `data/supabase/admin.ts` no rompe por
// faltarla. Server-only: nunca con prefijo `NEXT_PUBLIC_`.
export function getSupabaseSecretKey(): string {
  return required(supabaseSecretKey, "SUPABASE_SECRET_KEY");
}
