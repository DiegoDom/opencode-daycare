import { createClient } from "@/data/supabase/server";
import {
  firstName,
  initialsFrom,
  ROLE_LABELS,
  shortDaycareName,
  type SessionUser,
} from "@/lib/auth";
import type { Post, PostType } from "@/lib/feed-types";
import { avatarColors, buildAudience } from "@/lib/post-utils";

export type { Post, PostType };

export const composePlaceholder = "Compartí un momento…";

export interface FeedDisplay {
  roomLabel: string;
  greeting: string;
  childrenLine: string;
  composePlaceholder: string;
  currentUser: {
    name: string;
    initials: string;
    role: string;
    isParent: boolean;
  };
  posts: Post[];
}

// El cliente no lleva el tipo `Database`: los embeds se declaran a mano.
// `post_children`/`post_photos` llegan como arrays (FK → PK, relación many).
interface PostRow {
  id: string;
  author_id: string;
  author_name: string;
  room_id: string | null;
  type: string;
  body: string;
  published_at: string;
  post_children: { child_full_name: string }[];
  post_photos: { url: string; position: number }[];
}

// Snapshot de lo que la app necesita: nada de `children` ni `users` (el RLS de
// SPEC 12/09 no deja al padre leerlos; los nombres vienen de los snapshots).
const POST_SELECT =
  "id, author_id, author_name, room_id, type, body, published_at, " +
  "post_children(child_full_name), post_photos(url, position)";

// Mismo criterio local que `currentTimeHHMM` de SPEC 07: el producto es
// monozona y la hora sale del reloj del server.
function hhmm(iso: string): string {
  const date = new Date(iso);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// "sábado 17 oct" — dos formatters porque el de una sola pieza mete coma
// ("sábado, 17 oct") y el feed mock usaba el formato sin coma.
function todayLabel(): string {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("es", { weekday: "long" }).format(now);
  const dayMonth = new Intl.DateTimeFormat("es", {
    day: "numeric",
    month: "short",
  }).format(now);
  return `${weekday} ${dayMonth}`;
}

function toPost(row: PostRow, viewerId: string): Post {
  const childNames = row.post_children.map((child) => child.child_full_name);
  const recipients = childNames.map((name) => ({
    name,
    initials: initialsFrom(name),
    ...avatarColors(name),
  }));
  const photos = [...row.post_photos]
    .sort((a, b) => a.position - b.position)
    .map((photo) => ({ src: photo.url }));

  return {
    id: row.id,
    type: row.type as PostType,
    author: {
      name: row.author_name,
      initials: initialsFrom(row.author_name),
      ...avatarColors(row.author_name),
    },
    time: hhmm(row.published_at),
    publishedBy:
      row.author_id === viewerId
        ? "publicado por vos"
        : `publicado por ${row.author_name}`,
    audience: row.room_id
      ? "Para: toda la sala"
      : buildAudience(childNames),
    ...(recipients.length > 0 ? { recipients } : {}),
    body: row.body,
    // `PostCard` renderiza el grid si `photos` está presente, así que un array
    // vacío dejaría un hueco: se omite el campo en vez de mandar `[]`.
    ...(photos.length > 0 ? { photos } : {}),
    likes: 0,
    comments: 0,
  };
}

// El conteo lo da el RLS, no un filtro de la app: staff/admin cuentan los
// `children` de su guardería, un padre solo sus vínculos en `parent_children`
// (el padre no puede leer `children`, SPEC 12).
async function childrenLine(user: SessionUser): Promise<string> {
  const supabase = await createClient();
  const query =
    user.role === "parent"
      ? supabase.from("parent_children").select("child_id", { count: "exact", head: true })
      : supabase.from("children").select("id", { count: "exact", head: true });
  const { count, error } = await query;
  if (error) throw new Error(`getFeedDisplay: ${error.message}`);
  return `${count ?? 0} niños · ${todayLabel()}`;
}

// La visibilidad la decide el RLS de SPEC 18: acá solo se intersecta el
// `daycare_id` de la sesión (defensa en profundidad, no autorización).
export async function getFeedDisplay(user: SessionUser): Promise<FeedDisplay> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .eq("daycare_id", user.daycareId)
    .order("published_at", { ascending: false });

  if (error) throw new Error(`getFeedDisplay: ${error.message}`);
  const rows = (data ?? []) as unknown as PostRow[];

  const roleLabel = `${ROLE_LABELS[user.role]}${user.daycareName ? " · " + shortDaycareName(user.daycareName) : ""}`;
  return {
    roomLabel: user.daycareName ? `GUARDERÍA · ${shortDaycareName(user.daycareName)}` : "GUARDERÍA",
    greeting: `Buenas, ${firstName(user.fullName)}`,
    childrenLine: await childrenLine(user),
    composePlaceholder,
    currentUser: {
      name: user.fullName,
      initials: initialsFrom(user.fullName),
      role: roleLabel,
      isParent: user.role === "parent",
    },
    posts: rows.map((row) => toPost(row, user.id)),
  };
}
