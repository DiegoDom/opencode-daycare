export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function matchesName(name: string, query: string): boolean {
  const q = normalize(query.trim());
  if (!q) return true;
  return normalize(name).includes(q);
}