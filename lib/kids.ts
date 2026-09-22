import { kids, type Kid, type KidParent, type KidNote } from "@/data/mock/kids";

export type { Kid, KidParent, KidNote };

export function getKids(): Kid[] {
  return kids;
}

export function getKidById(id: string): Kid | undefined {
  return kids.find((kid) => kid.id === id);
}

export function searchKids(query: string): Kid[] {
  const q = query.trim().toLowerCase();
  if (!q) return kids;
  return kids.filter((kid) => kid.name.toLowerCase().includes(q));
}