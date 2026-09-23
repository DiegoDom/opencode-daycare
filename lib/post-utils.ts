import type { Post, PostType } from "@/data/mock/feed";

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

export function validateDescription(value: string): string | null {
  return value.trim() === "" ? "Escribí una descripción" : null;
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