import type { PostType } from "@/lib/feed-types";

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