"use client";

import Link from "next/link";
import { PlusIcon } from "./icons";
import type { PostType } from "@/lib/feed";
import type { Kid } from "@/lib/kids";

interface CreatePostShellProps {
  baseKids: Kid[];
  currentUser: { name: string; initials: string; role: string };
}

const TYPE_OPTIONS: { type: PostType; label: string; inactive: string }[] = [
  { type: "comida", label: "Comida", inactive: "bg-badge-honey-bg text-badge-honey" },
  { type: "siesta", label: "Siesta", inactive: "bg-badge-lavender-bg text-badge-lavender" },
  { type: "actividad", label: "Actividad", inactive: "bg-badge-blue-bg text-badge-blue" },
  { type: "logro", label: "Logro", inactive: "bg-badge-green-bg text-badge-green" },
  { type: "animo", label: "Ánimo", inactive: "bg-badge-rose-bg text-badge-rose" },
  { type: "foto", label: "Foto", inactive: "bg-badge-coral-bg text-badge-coral" },
  { type: "anuncio", label: "Anuncio", inactive: "bg-badge-indigo-bg text-badge-indigo" },
];

const SECTION_LABEL = "mb-[10px] text-xs font-extrabold tracking-[0.7px] text-muted";

export default function CreatePostShell({ baseKids }: CreatePostShellProps) {
  return (
    <div className="w-full max-w-[580px] overflow-hidden rounded-3xl border border-line bg-[#FBF4EC] shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]">
      <header className="flex items-center justify-between border-b border-line px-[26px] py-5">
        <Link href="/" className="text-[15px] font-bold text-muted">
          Cancelar
        </Link>
        <span className="font-display text-[18px] font-semibold text-ink">
          Nueva publicación
        </span>
        <button
          type="button"
          disabled
          className="text-[15px] font-extrabold text-terracotta disabled:opacity-40"
        >
          Publicar
        </button>
      </header>

      <div className="px-[26px] pb-[26px] pt-6">
        <section className="mb-[22px]">
          <h2 className={SECTION_LABEL}>PARA</h2>
          <div className="flex flex-wrap gap-[9px]">
            {baseKids.map((kid) => (
              <button
                key={kid.id}
                type="button"
                className="flex items-center gap-2 rounded-full border-[1.5px] border-line bg-card py-[6px] pl-[6px] pr-[14px] text-[14px] font-bold text-sand"
              >
                <span
                  className="flex h-[26px] w-[26px] items-center justify-center rounded-full font-display text-[13px] font-semibold"
                  style={{ backgroundColor: kid.avatarBg, color: kid.avatarColor }}
                >
                  {kid.initials}
                </span>
                {kid.name.split(" ")[0]}
              </button>
            ))}
            <button
              type="button"
              className="rounded-full border-[1.5px] border-line bg-card px-4 py-[6px] text-[14px] font-bold text-sand"
            >
              Toda la sala
            </button>
          </div>
        </section>

        <section className="mb-[22px]">
          <h2 className={SECTION_LABEL}>TIPO</h2>
          <div className="flex flex-wrap gap-[9px]">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.type}
                type="button"
                className={`rounded-full px-4 py-2 text-[13.5px] font-extrabold ${option.inactive}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mb-[22px]">
          <h2 className={SECTION_LABEL}>DESCRIPCIÓN</h2>
          <textarea
            placeholder="Contá cómo le fue hoy…"
            className="min-h-[120px] w-full resize-y rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white p-4 text-[15px] leading-normal text-ink"
          />
        </section>

        <section>
          <h2 className={SECTION_LABEL}>FOTOS</h2>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex h-24 w-24 flex-col items-center justify-center gap-[6px] rounded-[14px] border-[1.5px] border-dashed border-line-dashed bg-photo text-[#B0A290]"
            >
              <PlusIcon className="text-terracotta-deep" />
              <span className="text-[12px]">Agregar</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}