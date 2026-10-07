import type { Post, PostType } from "@/lib/feed-types";

export interface PostRecipient {
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
}

export interface PostDraft {
  type: PostType;
  recipients: PostRecipient[];
  wholeRoom: boolean;
  description: string;
  photos?: string[];
}

export const WHOLE_ROOM_AUTHOR: PostRecipient = {
  name: "Sala Soles",
  initials: "",
  avatarBg: "#CCD8F4",
  avatarColor: "#4E72C8",
};

// Paleta fija del mock (los 5 colores que usaban los componentes con datos
// mock) + el indigo del avatar de "Anuncio general". La BD no guarda colores:
// el índice sale de un hash determinista del nombre, igual que el de `lib/kids`.
const AVATAR_PALETTE = [
  { avatarBg: "#A9D9E8", avatarColor: "#1F7A93" },
  { avatarBg: "#CCD8F4", avatarColor: "#4E72C8" },
  { avatarBg: "#F4B8CC", avatarColor: "#C44A7A" },
  { avatarBg: "#B9DEC4", avatarColor: "#3E8B62" },
  { avatarBg: "#F4DC8E", avatarColor: "#9A7B1E" },
  { avatarBg: "#C9B6E8", avatarColor: "#7B5FC0" },
];

export function avatarColors(name: string): { avatarBg: string; avatarColor: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export function validateDescription(value: string): string | null {
  return value.trim() === "" ? "Escribí una descripción" : null;
}

// "Toda la sala" ⇒ roomId con valor y childIds vacío;
// destinatarios específicos ⇒ roomId null y ≥1 child. La exclusividad la
// valida tanto el shell como `createPostAction`.
export interface CreatePostDraft {
  type: PostType;
  description: string;
  roomId: string | null;
  childIds: string[];
  photos: File[];
}

export function buildAudience(names: string[]): string {
  const firstNames = names.map((name) => name.trim().split(/\s+/)[0] ?? name);
  if (firstNames.length === 0) return "Para: sin destinatarios";
  if (firstNames.length === 1) return `Para: familia de ${firstNames[0]}`;
  const head = firstNames.slice(0, -1).join(", ");
  return `Para: familia de ${head} y ${firstNames[firstNames.length - 1]}`;
}

export function currentTimeHHMM(): string {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function makePostId(): string {
  return "post-" + Date.now().toString(36);
}

export function buildPost(draft: PostDraft): Post {
  const wholeRoom = draft.wholeRoom;
  return {
    id: makePostId(),
    type: draft.type,
    author: wholeRoom
      ? WHOLE_ROOM_AUTHOR
      : draft.recipients[0] ?? WHOLE_ROOM_AUTHOR,
    time: currentTimeHHMM(),
    publishedBy: "publicado por vos",
    audience: wholeRoom
      ? "Para: toda la sala"
      : buildAudience(draft.recipients.map((recipient) => recipient.name)),
    recipients: wholeRoom ? undefined : draft.recipients,
    body: draft.description.trim(),
    photos: draft.photos?.map((src) => ({ src })),
    likes: 0,
    comments: 0,
  };
}