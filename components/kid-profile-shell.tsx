"use client";

import { useEffect, useState } from "react";
import type { Kid, KidParent } from "@/lib/kids";
import KidProfileHeader from "./kid-profile-header";
import KidDataCard from "./kid-data-card";
import KidNoteCard from "./kid-note-card";
import KidParentsCard from "./kid-parents-card";
import KidSummaryCard from "./kid-summary-card";
import LinkParentModal, { type LinkParentDraft } from "./link-parent-modal";

const STORAGE_KEY = "opdaycare.kids.v1";

const PALETTE = [
  { avatarBg: "#F4B8CC", avatarColor: "#C44A7A" },
  { avatarBg: "#A9D9E8", avatarColor: "#1F7A93" },
  { avatarBg: "#B9DEC4", avatarColor: "#3E8B62" },
  { avatarBg: "#F4DC8E", avatarColor: "#9A7B1E" },
  { avatarBg: "#C9B6E8", avatarColor: "#7B5FC0" },
];

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toUpperCase();
}

export default function KidProfileShell({ baseKid }: { baseKid: Kid }) {
  const [displayKid, setDisplayKid] = useState<Kid>(baseKid);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;
        const stored = parsed as Kid[];
        const override = stored.find((kid) => kid.id === baseKid.id);
        if (override) setDisplayKid(override);
      } catch {
        // localStorage deshabilitado: la vista usa solo baseKid
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [baseKid.id]);

  function handleSave(draft: LinkParentDraft) {
    const { avatarBg, avatarColor } = PALETTE[displayKid.parents.length % PALETTE.length];
    const parent: KidParent = {
      name: draft.name,
      initials: initialsOf(draft.name),
      avatarBg,
      avatarColor,
      role: draft.role,
      status: "invitación enviada",
      statusLabel: "PENDIENTE",
    };
    const updated: Kid = {
      ...displayKid,
      parents: [parent, ...displayKid.parents],
      parentsCount: displayKid.parentsCount + 1,
    };
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const stored = Array.isArray(parsed) ? (parsed as Kid[]) : [];
      const next = stored.some((kid) => kid.id === updated.id)
        ? stored.map((kid) => (kid.id === updated.id ? updated : kid))
        : [updated, ...stored];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage deshabilitado: vive solo en memoria durante la sesión
    }
    setDisplayKid(updated);
    setModalOpen(false);
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-10 py-[34px] pb-20">
      <KidProfileHeader kid={displayKid} />

      <div className="mt-[26px] flex flex-col gap-[18px] md:flex-row md:items-start md:gap-[26px]">
        <div className="flex min-w-0 flex-col gap-[18px] md:flex-1">
          {displayKid.note ? <KidNoteCard note={displayKid.note} /> : null}
          <KidDataCard kid={displayKid} />
        </div>

        <div className="flex flex-col gap-[14px] md:w-[300px] md:flex-none">
          <KidSummaryCard />
          <KidParentsCard kid={displayKid} onAdd={() => setModalOpen(true)} />
        </div>
      </div>

      {modalOpen && (
        <LinkParentModal
          kidName={displayKid.name}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}