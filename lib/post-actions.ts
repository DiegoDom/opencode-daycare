"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/data/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { type CreatePostDraft, validateDescription } from "@/lib/post-utils";

export type CreatePostState = { ok: boolean; error?: string };

// Mismos límites que el bucket `post-photos` (SPEC 18): la action valida para
// devolver un error amigable antes de subir nada. El RLS sigue siendo la
// puerta real; esto es defensa en profundidad.
const MAX_PHOTOS = 4;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_MIMES = ["image/png", "image/jpeg", "image/webp"];
const BUCKET = "post-photos";

const GENERIC_ERROR = "No pudimos publicar. Intentá de nuevo.";

// El nombre del archivo arma parte del path del objeto en Storage: nunca
// puede contener separadores de carpeta.
function safeFileName(name: string): string {
  return name.replace(/[/\\]/g, "_");
}

export async function createPostAction(draft: CreatePostDraft): Promise<CreatePostState> {
  const descriptionError = validateDescription(draft.description);
  if (descriptionError) return { ok: false, error: descriptionError };

  const childIds = [...new Set(draft.childIds)];
  if (draft.roomId !== null && childIds.length > 0) {
    return { ok: false, error: "Elegí la sala o destinatarios, no las dos cosas." };
  }
  if (draft.roomId === null && childIds.length === 0) {
    return { ok: false, error: "Elegí al menos un destinatario." };
  }

  if (draft.photos.length > MAX_PHOTOS) {
    return { ok: false, error: `Máximo ${MAX_PHOTOS} fotos por publicación.` };
  }
  for (const photo of draft.photos) {
    if (photo.size > MAX_PHOTO_BYTES) {
      return { ok: false, error: "Cada foto debe pesar menos de 5 MB." };
    }
    if (!PHOTO_MIMES.includes(photo.type)) {
      return { ok: false, error: "Solo se aceptan fotos en PNG, JPG o WebP." };
    }
  }

  const user = await getCurrentUser();
  if (!user || user.status !== "active" || user.role === "parent") {
    return { ok: false, error: "No tenés permiso para publicar." };
  }

  const supabase = await createClient();

  // Los nombres de los destinatarios son snapshots: se leen de `children`
  // (RLS-scoped a la guardería de la sesión) y se copian a `post_children`.
  let recipients: { id: string; fullName: string }[] = [];
  if (childIds.length > 0) {
    const { data, error } = await supabase
      .from("children")
      .select("id, full_name")
      .in("id", childIds);
    if (error) {
      console.error("[createPostAction] children:", error.message, error.code);
      return { ok: false, error: GENERIC_ERROR };
    }
    const rows = (data ?? []) as unknown as { id: string; full_name: string }[];
    if (rows.length !== childIds.length) {
      return { ok: false, error: "Alguno de los destinatarios ya no está en la guardería." };
    }
    recipients = rows.map((row) => ({ id: row.id, fullName: row.full_name }));
  }

  // El id se genera antes de subir para armar el path {daycare}/{post}/{i}-…
  const postId = crypto.randomUUID();

  const photoUrls: string[] = [];
  for (let i = 0; i < draft.photos.length; i++) {
    const file = draft.photos[i];
    const path = `${user.daycareId}/${postId}/${i}-${safeFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      console.error("[createPostAction] upload:", error.message);
      return { ok: false, error: "No pudimos subir las fotos. Probá con menos fotos." };
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    photoUrls.push(data.publicUrl);
  }

  const { error: postError } = await supabase.from("posts").insert({
    id: postId,
    daycare_id: user.daycareId,
    author_id: user.id,
    author_name: user.fullName,
    room_id: draft.roomId,
    type: draft.type,
    body: draft.description.trim(),
  });
  if (postError) {
    console.error("[createPostAction] posts:", postError.message, postError.code);
    return { ok: false, error: GENERIC_ERROR };
  }

  if (recipients.length > 0) {
    const { error } = await supabase.from("post_children").insert(
      recipients.map((recipient) => ({
        daycare_id: user.daycareId,
        post_id: postId,
        child_id: recipient.id,
        child_full_name: recipient.fullName,
      })),
    );
    if (error) {
      console.error("[createPostAction] post_children:", error.message, error.code);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  if (photoUrls.length > 0) {
    const { error } = await supabase.from("post_photos").insert(
      photoUrls.map((url, position) => ({ post_id: postId, url, position })),
    );
    if (error) {
      console.error("[createPostAction] post_photos:", error.message, error.code);
      return { ok: false, error: GENERIC_ERROR };
    }
  }

  revalidatePath("/");
  return { ok: true };
}
