import type { ReactNode } from "react";

import type { Kid, Room } from "@/lib/kids";
import KidCard from "./kid-card";
import KidsEmpty from "./kids-empty";
import KidsHeader from "./kids-header";

interface KidsShellProps {
  baseKids: Kid[];
  rooms: Room[];
  children?: ReactNode;
}

interface KidGroup {
  label: string;
  kids: Kid[];
}

function RoomSection({ group }: { group: KidGroup }) {
  return (
    <div className="mb-6">
      <div className="mb-[14px] flex items-center gap-3">
        <span className="text-[12.5px] font-extrabold tracking-[0.8px] text-ink">
          {group.label}
        </span>
        <span className="text-[13px] text-faint">
          {group.kids.length} {group.kids.length === 1 ? "niño" : "niños"}
        </span>
        <span className="h-px flex-1 bg-[#E7DAC8]" />
      </div>
      <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
        {group.kids.map((kid) => (
          <KidCard key={kid.id} kid={kid} />
        ))}
      </div>
    </div>
  );
}

export default function KidsShell({ baseKids, rooms, children }: KidsShellProps) {
  // Se listan todas las salas, incluso vacías (criterio de SPEC 12), con las
  // que tienen niños arriba. Los niños sin sala caen en su propio grupo.
  const groups: KidGroup[] = rooms
    .map((room) => ({
      label: `SALA ${room.name.toUpperCase()}`,
      kids: baseKids.filter((kid) => kid.room === room.name),
    }))
    .sort((a, b) => b.kids.length - a.kids.length || a.label.localeCompare(b.label));
  const orphanKids = baseKids.filter((kid) => kid.room === "");

  return (
    <>
      <KidsHeader rooms={rooms} />
      {children}

      {baseKids.length === 0 ? (
        <KidsEmpty />
      ) : (
        <>
          {groups.map((group) => (
            <RoomSection key={group.label} group={group} />
          ))}
          {orphanKids.length > 0 && (
            <RoomSection group={{ label: "SIN SALA", kids: orphanKids }} />
          )}
        </>
      )}
    </>
  );
}
