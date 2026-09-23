export function parseBirthDate(value: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function isValidBirthDate(value: string): boolean {
  const date = parseBirthDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}

export function validateName(name: string): string | undefined {
  if (name.trim() === "") return "Ingresa el nombre completo";
  return undefined;
}

export function validateBirthDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return "Ingresa la fecha de nacimiento";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length > 0 && digits.length < 8) {
    return "Completa la fecha (dd/mm/aaaa)";
  }
  const date = parseBirthDate(trimmed);
  if (!date) return "Fecha no válida";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) return "No puede ser una fecha futura";
  return undefined;
}

export function formatBirthDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatISOToInput(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [year, month, day] = parts;
  if (year.length !== 4 || month.length !== 2 || day.length !== 2) return "";
  return `${day}/${month}/${year}`;
}

export function todayISO(): string {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function isValidDraft(draft: { name: string; birthDate: string; room: string }): boolean {
  const ROOMS = ["Soles", "Estrellas", "Lunitas"];
  return (
    validateName(draft.name) === undefined &&
    validateBirthDate(draft.birthDate) === undefined &&
    ROOMS.includes(draft.room)
  );
}

export function validateParentName(value: string): string | null {
  if (value.trim().length <= 1) return "Ingresa el nombre";
  return null;
}

export function validateParentEmail(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return "Ingresa el email";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return "Email no válido";
  return null;
}

export function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
