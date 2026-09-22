"use client";

import { type FormEvent, useEffect, useState } from "react";

export interface AddKidDraft {
  name: string;
  birthDate: string;
  room: string;
  allergies: string;
  notes: string;
}

const ROOMS = ["Soles", "Estrellas", "Lunitas"];

interface AddKidModalProps {
  onClose: () => void;
  onSave: (draft: AddKidDraft) => void;
}

export function parseBirthDate(value: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

function isValidBirthDate(value: string): boolean {
  const date = parseBirthDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
}

export default function AddKidModal({ onClose, onSave }: AddKidModalProps) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [room, setRoom] = useState(ROOMS[0]);
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");

  const valid =
    name.trim() !== "" && isValidBirthDate(birthDate) && ROOMS.includes(room);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) return;
    onSave({
      name: name.trim(),
      birthDate: birthDate.trim(),
      room,
      allergies: allergies.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-label="Agregar niño"
        className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[24px] border border-line bg-[#FBF4EC] shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <header className="flex flex-none items-center justify-between border-b border-line px-[26px] py-[20px]">
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-bold text-muted"
          >
            Cancelar
          </button>
          <span className="font-display text-[18px] font-semibold text-ink">
            Agregar niño
          </span>
          <button
            type="submit"
            disabled={!valid}
            className="text-[15px] font-extrabold text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
          >
            Guardar
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-[26px] py-6">
          <label className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted">
            NOMBRE COMPLETO
          </label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Martina López"
            autoComplete="off"
            autoFocus
            className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[13px] text-[15px] text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral"
          />

          <div className="mb-[18px] flex gap-[14px]">
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted">
                FECHA DE NACIMIENTO
              </label>
              <input
                type="text"
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                placeholder="dd/mm/aaaa"
                autoComplete="off"
                inputMode="numeric"
                className="w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[13px] text-[15px] text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral"
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted">
                SALA
              </label>
              <div className="relative">
                <select
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  className="w-full appearance-none rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[13px] pr-10 text-[15px] font-bold text-ink outline-none focus:border-coral"
                >
                  {ROOMS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#B0A290]"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
            </div>
          </div>

          <label className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted">
            ALERGIAS (ETIQUETAS)
          </label>
          <input
            type="text"
            value={allergies}
            onChange={(event) => setAllergies(event.target.value)}
            placeholder="Ej. Maní, Lactosa"
            autoComplete="off"
            className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[13px] text-[15px] text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral"
          />

          <label className="mb-2 block text-[12px] font-extrabold tracking-[0.7px] text-muted">
            NOTAS MÉDICAS
          </label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Indicaciones, medicación, contactos…"
            className="w-full resize-y rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[13px] text-[15px] leading-[1.5] text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral"
            style={{ minHeight: 90 }}
          />
        </div>
      </form>
    </div>
  );
}