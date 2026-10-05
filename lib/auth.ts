export type UserRole = "staff" | "parent" | "admin";

export type UserStatus = "pending" | "active";

export interface SessionUser {
  id: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  daycareId: string;
  daycareName: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  staff: "Maestra",
  parent: "Familia",
  admin: "Directora",
};

export function initialsFrom(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0];
}

export function shortDaycareName(daycareName: string): string {
  return daycareName.replace(/^Guardería\s+/i, "").trim().toUpperCase();
}