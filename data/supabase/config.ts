const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

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
