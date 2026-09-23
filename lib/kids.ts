import { kids, type Kid, type KidParent, type KidNote } from "@/data/mock/kids";
import { matchesName, normalize } from "./kid-utils";

export type { Kid, KidParent, KidNote };

export function getKids(): Kid[] {
  return kids;
}

export function getKidById(id: string): Kid | undefined {
  return kids.find((kid) => kid.id === id);
}

export function searchKids(query: string): Kid[] {
  const q = normalize(query.trim());
  if (!q) return kids;
  return kids.filter((kid) => matchesName(kid.name, query));
}