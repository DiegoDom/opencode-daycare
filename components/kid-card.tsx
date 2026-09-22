import Link from "next/link";
import type { Kid } from "@/lib/kids";
import { ChevronRightIcon } from "./icons";

const VINCULAR_BADGE = { bg: "#F9D2DE", text: "#C56486" };

export default function KidCard({ kid }: { kid: Kid }) {
  const parentsLabel =
    kid.parentsCount === 0
      ? "sin padres vinculados"
      : `${kid.parentsCount} padre${kid.parentsCount === 1 ? "" : "s"} vinculado${
          kid.parentsCount === 1 ? "" : "s"
        }`;

  return (
    <Link
      href={`/ninos/${kid.id}`}
      className="flex items-center gap-[14px] rounded-[18px] border border-line bg-card px-4 py-4 shadow-[0_4px_14px_-12px_rgba(120,90,60,0.5)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#F2A78E]"
    >
      <div
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full font-display text-[19px] font-semibold"
        style={{ backgroundColor: kid.avatarBg, color: kid.avatarColor }}
      >
        {kid.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-base font-semibold text-ink">{kid.name}</div>
        <div className="text-[13px] text-faint">
          {kid.age} años · {parentsLabel}
        </div>
      </div>
      {kid.badge ? (
        <span
          className="flex-none rounded-full px-[9px] py-[5px] text-[11px] font-extrabold"
          style={{ backgroundColor: kid.badge.bg, color: kid.badge.text }}
        >
          {kid.badge.label}
        </span>
      ) : kid.parentsCount === 0 ? (
        <span
          className="flex-none rounded-full px-[9px] py-[5px] text-[11px] font-extrabold"
          style={{ backgroundColor: VINCULAR_BADGE.bg, color: VINCULAR_BADGE.text }}
        >
          VINCULAR
        </span>
      ) : (
        <ChevronRightIcon className="flex-none text-[#CBB89F]" />
      )}
    </Link>
  );
}