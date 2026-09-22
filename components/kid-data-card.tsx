import type { Kid } from "@/lib/kids";

const ROWS: { label: string; key: keyof Pick<Kid, "birthDate" | "room" | "enrollmentDate"> }[] = [
  { label: "Fecha de nacimiento", key: "birthDate" },
  { label: "Sala", key: "room" },
  { label: "Ingreso", key: "enrollmentDate" },
];

export default function KidDataCard({ kid }: { kid: Kid }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      {ROWS.map((row, index) => (
        <div
          key={row.label}
          className={`flex items-center justify-between px-[18px] py-[15px] ${
            index < ROWS.length - 1 ? "border-b border-line-soft" : ""
          }`}
        >
          <span className="text-[14.5px] text-muted">{row.label}</span>
          <span className="text-[14.5px] font-extrabold text-ink">{kid[row.key]}</span>
        </div>
      ))}
    </div>
  );
}