import { createHash, randomInt } from "node:crypto";

const CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 8;

// Server-only: `node:crypto` no se serializa a un Client Component. El código se
// genera en el servidor, se envía por email y se devuelve al modal; el hash vive
// en la BD. El texto plano nunca se persiste.
export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}