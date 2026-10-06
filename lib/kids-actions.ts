"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/data/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { normalize } from "@/lib/kid-utils";
import { parseBirthDate, validateBirthDate, validateName, todayISO } from "@/lib/kid-validation";
import { ALLERGY_LABELS } from "@/lib/kids";

export interface AddKidDraft {
  name: string;
  birthDate: string; // dd/mm/aaaa, el formato del input del modal
  room: string; // nombre de la sala; la action lo resuelve a room_id
  allergies: string; // texto libre, coma-separado
  notes: string;
}

export interface AddKidState {
  error?: string;
}

function isoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Texto del formulario → tag del catálogo ("Maní" → peanut). Lo que no está en
// el catálogo queda como se escribió y `badgeOf` lo muestra en mayúsculas.
function toAllergyTag(value: string): string {
  const normalized = normalize(value);
  const singular = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  for (const [tag, label] of Object.entries(ALLERGY_LABELS)) {
    const normalizedLabel = normalize(label);
    if (normalizedLabel === normalized || normalizedLabel === singular) return tag;
  }
  return value;
}

function allergyTags(input: string): string[] {
  const tags = input
    .split(",")
    .map((piece) => piece.trim())
    .filter((piece) => piece !== "")
    .map(toAllergyTag);
  return [...new Set(tags)];
}

export async function addChildAction(draft: AddKidDraft): Promise<AddKidState> {
  const name = draft.name.trim();
  const nameError = validateName(name);
  if (nameError) return { error: nameError };

  const dateError = validateBirthDate(draft.birthDate);
  if (dateError) return { error: dateError };
  const birthDate = parseBirthDate(draft.birthDate);
  if (!birthDate) return { error: "Fecha no válida" };

  const user = await getCurrentUser();
  if (!user || user.status !== "active" || user.role === "parent") {
    return { error: "No tenés permiso para agregar niños." };
  }

  const supabase = await createClient();

  // El RLS garantiza que solo se resuelvan salas de la guardería de la sesión.
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id")
    .eq("name", draft.room)
    .maybeSingle();
  if (roomError) {
    console.error("[addChildAction] rooms:", roomError.message, roomError.code);
    return { error: "No pudimos guardar el niño. Intentá de nuevo." };
  }
  if (!room) return { error: "Elegí una sala válida." };

  const notes = draft.notes.trim();
  console.error("[addChildAction] about to insert", {
    daycareId: user.daycareId,
    roomId: room.id,
    name,
    birthDate: isoDate(birthDate),
    enrolledAt: todayISO(),
    allergyTags: allergyTags(draft.allergies),
    hasNotes: notes !== "",
  });
  const { error } = await supabase.from("children").insert({
    daycare_id: user.daycareId,
    room_id: room.id,
    full_name: name,
    birth_date: isoDate(birthDate),
    enrolled_at: todayISO(),
    allergy_tags: allergyTags(draft.allergies),
    medical_notes: notes === "" ? null : notes,
    photo_consent: true,
    status: "active",
  });
  if (error) {
    console.error("[addChildAction] insert ERROR:", JSON.stringify(error));
    return { error: "No pudimos guardar el niño. Intentá de nuevo." };
  }

  revalidatePath("/kids");
  return {};
}
