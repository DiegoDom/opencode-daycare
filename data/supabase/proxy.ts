import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/data/supabase/config";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Con Fluid compute, no guardes este cliente en una variable global:
  // creá uno nuevo en cada request.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => supabaseResponse.headers.set(key, value));
      },
    },
  });

  // No ejecutes código entre createServerClient y supabase.auth.getClaims():
  // un simple error ahí hace muy difícil depurar usuarios deslogueados al azar.
  // Si lo quitás y usás SSR con el cliente de Supabase, el logout es aleatorio.
  await supabase.auth.getClaims();

  // IMPORTANTE: devolvé `supabaseResponse` tal cual. Si creás otra respuesta,
  // copiale las cookies y los headers de cache antes:
  //   const myNewResponse = NextResponse.next({ request });
  //   myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll());
  //   for (const header of ["cache-control", "expires", "pragma"]) { ... }
  return supabaseResponse;
}
