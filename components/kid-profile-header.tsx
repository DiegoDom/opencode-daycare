import Link from "next/link";
import type { Kid } from "@/lib/kids";
import { ArrowLeftIcon } from "./icons";

export default function KidProfileHeader({ kid }: { kid: Kid }) {
  return (
    <>
      <Link
        href="/ninos"
        className="mb-5 flex items-center gap-[7px] text-sm font-bold text-muted"
      >
        <ArrowLeftIcon />
        Volver a Niños
      </Link>

      <div className="flex items-center gap-[18px]">
        <div
          className="flex h-[84px] w-[84px] flex-none items-center justify-center rounded-full font-display text-[34px] font-semibold"
          style={{ backgroundColor: kid.avatarBg, color: kid.avatarColor }}
        >
          {kid.initials}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[28px] font-semibold text-ink">{kid.name}</h1>
          <p className="mt-[3px] text-[15px] text-muted">
            {kid.age} años · Sala {kid.room}
          </p>
        </div>
        <button
          type="button"
          className="flex-none rounded-xl border-[1.5px] border-line bg-card px-4 py-[9px] text-sm font-bold text-sand"
        >
          Editar
        </button>
      </div>
    </>
  );
}