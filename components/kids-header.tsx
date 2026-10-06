"use client";

import { useRef, useState } from "react";

import type { Room } from "@/lib/kids";
import AddKidModal from "./add-kid-modal";
import { PlusIcon } from "./icons";

interface KidsHeaderProps {
  rooms: Room[];
}

export default function KidsHeader({ rooms }: KidsHeaderProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  function closeModal() {
    setModalOpen(false);
    addRef.current?.focus();
  }

  return (
    <>
      <div className="mb-[22px] flex items-end justify-between gap-4">
        <div>
          <div className="mb-1 text-[12.5px] font-extrabold tracking-[0.8px] text-terracotta">
            GESTIÓN
          </div>
          <h1 className="font-display text-[30px] font-semibold text-ink">Niños</h1>
        </div>
        <button
          ref={addRef}
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-[14px] bg-gradient-to-b from-peach to-coral px-[18px] py-[11px] text-[14.5px] font-extrabold text-white shadow-[0_8px_18px_-8px_rgba(238,129,100,0.7)]"
        >
          <PlusIcon />
          Agregar niño
        </button>
      </div>
      {modalOpen && <AddKidModal rooms={rooms} onClose={closeModal} />}
    </>
  );
}
