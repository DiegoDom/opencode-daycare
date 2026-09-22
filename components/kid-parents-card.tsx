import type { Kid } from "@/lib/kids";
import { PlusIcon } from "./icons";

const STATUS_CLASSES: Record<Kid["parents"][number]["statusLabel"], string> = {
  ACTIVA: "bg-badge-green-bg text-badge-green",
  PENDIENTE: "bg-[#F7E7A6] text-[#9A7B1E]",
};

export default function KidParentsCard({ kid }: { kid: Kid }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-[18px] py-4">
      <div className="mb-[14px] text-[12.5px] font-extrabold tracking-[0.8px] text-[#8A7C6D]">
        PADRES VINCULADOS
      </div>

      <div className="flex flex-col gap-[14px]">
        {kid.parents.map((parent) => (
          <div key={parent.name} className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full font-display text-base font-semibold"
              style={{ backgroundColor: parent.avatarBg, color: parent.avatarColor }}
            >
              {parent.initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-extrabold text-ink">{parent.name}</div>
              <div className="text-[12.5px] text-faint">
                {parent.role} · {parent.status}
              </div>
            </div>
            <span
              className={`flex-none rounded-full px-[9px] py-1 text-[10.5px] font-extrabold ${STATUS_CLASSES[parent.statusLabel]}`}
            >
              {parent.statusLabel}
            </span>
          </div>
        ))}

        <button type="button" className="flex items-center gap-3 pt-2 text-left">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border-[1.5px] border-dashed border-[#D8CBBA] text-[#B0A290]">
            <PlusIcon />
          </span>
          <span className="font-extrabold text-[14.5px] text-terracotta-deep">
            Vincular otro padre
          </span>
        </button>
      </div>
    </div>
  );
}