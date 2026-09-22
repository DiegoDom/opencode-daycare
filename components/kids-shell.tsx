"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import AddKidModal, { type AddKidDraft, parseBirthDate } from "./add-kid-modal";
import KidCard from "./kid-card";
import KidsEmpty from "./kids-empty";
import KidsHeader from "./kids-header";
import { matchesName, normalize } from "@/lib/kid-utils";
import type { Kid } from "@/lib/kids";

const STORAGE_KEY = "opdaycare.kids.v1";
const ROOMS = ["Soles", "Estrellas", "Lunitas"];

const PALETTE = [
  { avatarBg: "#F4B8CC", avatarColor: "#C44A7A" },
  { avatarBg: "#A9D9E8", avatarColor: "#1F7A93" },
  { avatarBg: "#B9DEC4", avatarColor: "#3E8B62" },
  { avatarBg: "#F4DC8E", avatarColor: "#9A7B1E" },
  { avatarBg: "#C9B6E8", avatarColor: "#7B5FC0" },
];

const MONTHS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

const ALLERGY_BADGE_STYLE = { bg: "#FBD8CC", text: "#D9684A" };

interface KidsShellProps {
  baseKids: Kid[];
  query: string;
  children?: ReactNode;
}

function slug(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

function ageFromDate(date: Date): number {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthsDiff = today.getMonth() - date.getMonth();
  if (monthsDiff < 0 || (monthsDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

function allergyBadge(allergies: string): { label: string; bg: string; text: string } | undefined {
  const text = normalize(allergies);
  if (text.includes("mani")) return { label: "MANÍ", ...ALLERGY_BADGE_STYLE };
  if (text.includes("lactosa")) return { label: "LACTOSA", ...ALLERGY_BADGE_STYLE };
  return undefined;
}

function buildKid(draft: AddKidDraft, paletteIndex: number): Kid {
  const date = parseBirthDate(draft.birthDate);
  const today = new Date();
  const { avatarBg, avatarColor } = PALETTE[paletteIndex % PALETTE.length];
  const badge = allergyBadge(draft.allergies);
  const noteFragments = [draft.allergies, draft.notes].filter((text) => text !== "");
  const note =
    noteFragments.length > 0
      ? { title: "Alergias y notas", text: noteFragments.join("\n") }
      : undefined;

  return {
    id: `${slug(draft.name)}-${Date.now().toString(36)}`,
    name: draft.name,
    initials: initialsOf(draft.name),
    avatarBg,
    avatarColor,
    age: date ? ageFromDate(date) : 0,
    parentsCount: 0,
    parents: [],
    birthDate: date
      ? `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
      : draft.birthDate,
    room: draft.room,
    enrollmentDate: `${MONTHS[today.getMonth()]} ${today.getFullYear()}`,
    ...(badge ? { badge } : {}),
    ...(note ? { note } : {}),
  };
}

export default function KidsShell({ baseKids, query, children }: KidsShellProps) {
  const [addedKids, setAddedKids] = useState<Kid[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) setAddedKids(parsed as Kid[]);
        }
      } catch {
        // localStorage deshabilitado: fallback a estado en memoria
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const addedIds = useMemo(() => new Set(addedKids.map((kid) => kid.id)), [addedKids]);
  const visibleKids = useMemo(
    () => [...addedKids, ...baseKids].filter((kid) => matchesName(kid.name, query)),
    [addedKids, baseKids, query],
  );
  const groups = ROOMS.map((room) => ({
    room,
    kids: visibleKids.filter((kid) => kid.room === room),
  })).filter((group) => group.kids.length > 0);

  function closeModal() {
    setModalOpen(false);
    addButtonRef.current?.focus();
  }

  function handleSave(draft: AddKidDraft) {
    const kid = buildKid(draft, addedKids.length);
    const next = [kid, ...addedKids];
    setAddedKids(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage deshabilitado: vive solo en memoria durante la sesión
    }
    closeModal();
  }

  return (
    <>
      <KidsHeader onAdd={() => setModalOpen(true)} addRef={addButtonRef} />
      {children}

      {groups.length === 0 ? (
        <KidsEmpty />
      ) : (
        groups.map((group) => (
          <div key={group.room} className="mb-6">
            <div className="mb-[14px] flex items-center gap-3">
              <span className="text-[12.5px] font-extrabold tracking-[0.8px] text-ink">
                SALA {group.room.toUpperCase()}
              </span>
              <span className="text-[13px] text-faint">
                {group.kids.length} {group.kids.length === 1 ? "niño" : "niños"}
              </span>
              <span className="h-px flex-1 bg-[#E7DAC8]" />
            </div>
            <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2">
              {group.kids.map((kid) => (
                <KidCard
                  key={kid.id}
                  kid={kid}
                  link={addedIds.has(kid.id) ? null : `/kids/${kid.id}`}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {modalOpen && <AddKidModal onClose={closeModal} onSave={handleSave} />}
    </>
  );
}