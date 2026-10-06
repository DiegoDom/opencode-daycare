import { cache } from "react";

import { createClient } from "@/data/supabase/server";
import { matchesName, normalize } from "./kid-utils";

export type ParentRole = "Mamá" | "Papá" | "Tutor/a";
export type ParentStatus = "activa" | "invitación enviada";

export interface KidParent {
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  role: ParentRole;
  status: ParentStatus;
  statusLabel: "ACTIVA" | "PENDIENTE";
}

export interface KidNote {
  title: string;
  text: string;
}

export interface Kid {
  id: string;
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  age: number;
  parentsCount: number;
  birthDate: string;
  room: string;
  enrollmentDate: string;
  badge?: { label: string; bg: string; text: string };
  note?: KidNote;
  parents: KidParent[];
}

export interface Room {
  id: string;
  name: string;
}

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Mismo PALETTE de 5 colores que usaban los componentes con datos mock.
// La BD no guarda colores: el índice sale de un hash determinista del id.
const PALETTE = [
  { avatarBg: "#F4B8CC", avatarColor: "#C44A7A" },
  { avatarBg: "#A9D9E8", avatarColor: "#1F7A93" },
  { avatarBg: "#B9DEC4", avatarColor: "#3E8B62" },
  { avatarBg: "#F4DC8E", avatarColor: "#9A7B1E" },
  { avatarBg: "#C9B6E8", avatarColor: "#7B5FC0" },
];

const ALLERGY_BADGE_STYLE = { bg: "#FBD8CC", text: "#D9684A" };

// Catálogo de la spec: tag en inglés → label en español; sin match se muestra
// el tag en mayúsculas tal cual. `addChildAction` lo usa inverso (texto del
// formulario → tag).
export const ALLERGY_LABELS: Record<string, string> = {
  peanut: "MANÍ",
  lactose: "LACTOSA",
  gluten: "GLUTEN",
  egg: "HUEVO",
  soy: "SOJA",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHILDREN_SELECT =
  "id, full_name, birth_date, enrolled_at, medical_notes, allergy_tags, room_id, rooms(name)";

interface ChildRow {
  id: string;
  full_name: string;
  birth_date: string;
  enrolled_at: string;
  medical_notes: string | null;
  allergy_tags: string[] | null;
  room_id: string | null;
  rooms: { name: string } | null;
}

function parseDate(value: string): Date | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!parts) return null;
  return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
}

function formatDay(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function ageAt(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthsDiff = today.getMonth() - date.getMonth();
  if (monthsDiff < 0 || (monthsDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

function paletteIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % PALETTE.length;
}

function badgeOf(tags: string[]): Kid["badge"] {
  const first = tags[0];
  if (first === undefined) return undefined;
  return { label: ALLERGY_LABELS[first] ?? first.toUpperCase(), ...ALLERGY_BADGE_STYLE };
}

function toKid(row: ChildRow): Kid {
  const birthDate = parseDate(row.birth_date);
  const enrolledAt = parseDate(row.enrolled_at);
  const avatar = PALETTE[paletteIndex(row.id)];
  const badge = badgeOf(row.allergy_tags ?? []);
  const medicalNotes = row.medical_notes?.trim();

  return {
    id: row.id,
    name: row.full_name,
    initials: initialsOf(row.full_name),
    avatarBg: avatar.avatarBg,
    avatarColor: avatar.avatarColor,
    age: birthDate ? ageAt(birthDate) : 0,
    parentsCount: 0,
    parents: [],
    birthDate: birthDate ? formatDay(birthDate) : row.birth_date,
    room: row.rooms?.name ?? "",
    enrollmentDate: enrolledAt ? formatMonthYear(enrolledAt) : row.enrolled_at,
    ...(badge ? { badge } : {}),
    ...(medicalNotes ? { note: { title: "Alergias y notas", text: medicalNotes } } : {}),
  };
}

// El scoping por guardería lo hace el RLS con las cookies de la sesión, no el
// código: acá solo se trae lo que el rol de la sesión puede ver.
// `cache()` deduplica las llamadas del mismo request (padrón de `lib/auth.ts`).
const fetchKids = cache(async (): Promise<Kid[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select(CHILDREN_SELECT)
    .order("full_name");

  if (error) throw new Error(`getKids: ${error.message}`);
  return ((data ?? []) as unknown as ChildRow[]).map(toKid);
});

export async function getKids(): Promise<Kid[]> {
  return fetchKids();
}

export async function getKidById(id: string): Promise<Kid | undefined> {
  // Una URL con id que no es uuid no llega a la BD: se trata como inexistente.
  if (!UUID_PATTERN.test(id)) return undefined;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("children")
    .select(CHILDREN_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getKidById: ${error.message}`);
  if (!data) return undefined;
  return toKid(data as unknown as ChildRow);
}

// El total de la guardería (decenas de filas, RLS-scoped) se trae una vez y se
// filtra en memoria: `matchesName` es insensible a acentos, un `ILIKE` no.
export async function searchKids(query: string): Promise<Kid[]> {
  const kids = await fetchKids();
  const q = normalize(query.trim());
  if (!q) return kids;
  return kids.filter((kid) => matchesName(kid.name, query));
}

export async function getRooms(): Promise<Room[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rooms").select("id, name").order("name");

  if (error) throw new Error(`getRooms: ${error.message}`);
  return (data ?? []) as unknown as Room[];
}
