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
  const { data: claims } = await supabase.auth.getClaims();

  const pathname = request.nextUrl.pathname;
  const isPublic = pathname === "/login" || pathname === "/activate-account";
  const hasSession = Boolean(claims?.claims?.sub);

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Solo un path relativo del propio sitio; `safeRedirectPath` no es
    // necesario acá porque ya partimos de una request interna, pero
    // construimos con `next` explícito.
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    url.searchParams.set("next", next);
    const redirectResponse = NextResponse.redirect(url);

    // Copiar cookies y headers de cache para no perder el refresh de sesión
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    for (const header of ["cache-control", "expires", "pragma"] as const) {
      const value = supabaseResponse.headers.get(header);
      if (value) redirectResponse.headers.set(header, value);
    }
    return redirectResponse;
  }

  // IMPORTANTE: devolvé `supabaseResponse` tal cual. Si creás otra respuesta,
  // copiale las cookies y los headers de cache antes:
  //   const myNewResponse = NextResponse.next({ request });
  //   myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll());
  //   for (const header of ["cache-control", "expires", "pragma"]) { ... }
  return supabaseResponse;
}
