import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseSecretKey, getSupabaseUrl } from "./config";

// Cliente Admin de servidor exclusivo. `service_role` omite RLS: por eso solo
// vive acá (lo consume `lib/`), nunca en `app/` ni `components/`, y su clave
// viaja en `SUPABASE_SECRET_KEY` sin prefijo `NEXT_PUBLIC_`.
export function createClient(): SupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
