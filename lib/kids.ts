import { kids, type Kid, type KidParent, type KidNote } from "@/data/mock/kids";

export type { Kid, KidParent, KidNote };

export function getKids(): Kid[] {
  return kids;
}

export function getKidById(id: string): Kid | undefined {
  return kids.find((kid) => kid.id === id);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function searchKids(query: string): Kid[] {
  const q = normalize(query.trim());
  if (!q) return kids;
  return kids.filter((kid) => normalize(kid.name).includes(q));
}