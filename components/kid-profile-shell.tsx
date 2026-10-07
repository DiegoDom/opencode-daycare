"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Kid, Room } from "@/lib/kids";
import KidProfileHeader from "./kid-profile-header";
import KidDataCard from "./kid-data-card";
import KidNoteCard from "./kid-note-card";
import KidParentsCard from "./kid-parents-card";
import KidSummaryCard from "./kid-summary-card";
import LinkParentModal from "./link-parent-modal";
import EditKidModal from "./edit-kid-modal";

export default function KidProfileShell({ baseKid, rooms }: { baseKid: Kid; rooms: Room[] }) {
  const router = useRouter();
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const linkTriggerRef = useRef<HTMLButtonElement>(null);
  const editTriggerRef = useRef<HTMLButtonElement>(null);

  function closeLinkModal() {
    setLinkModalOpen(false);
    linkTriggerRef.current?.focus();
  }

  function closeEditModal() {
    setEditModalOpen(false);
    editTriggerRef.current?.focus();
  }

  // Tras invitar, la card PADRES VINCULADOS se re-llena desde la BD: el refresh
  // re-renderiza el Server Component y `getKidById` trae la invitación nueva.
  function handleInvited() {
    router.refresh();
  }

  return (
    <div className="mx-auto w-full max-w-[820px] px-10 py-[34px] pb-20">
      <KidProfileHeader kid={baseKid} onEdit={() => setEditModalOpen(true)} editRef={editTriggerRef} />

      <div className="mt-[26px] flex flex-col gap-[18px] md:flex-row md:items-start md:gap-[26px]">
        <div className="flex min-w-0 flex-col gap-[18px] md:flex-1">
          {baseKid.note ? <KidNoteCard note={baseKid.note} /> : null}
          <KidDataCard kid={baseKid} />
        </div>

        <div className="flex flex-col gap-[14px] md:w-[300px] md:flex-none">
          <KidSummaryCard />
          <KidParentsCard
            kid={baseKid}
            onAdd={() => setLinkModalOpen(true)}
            buttonRef={linkTriggerRef}
          />
        </div>
      </div>

      {linkModalOpen && (
        <LinkParentModal
          childId={baseKid.id}
          kidName={baseKid.name}
          onClose={closeLinkModal}
          onSaved={handleInvited}
        />
      )}
      {editModalOpen && (
        <EditKidModal
          kid={baseKid}
          rooms={rooms}
          onClose={closeEditModal}
        />
      )}
    </div>
  );
}