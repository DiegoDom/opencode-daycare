"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { CalendarIcon } from "./icons";
import {
  formatBirthDateInput,
  formatISOToInput,
  todayISO,
  validateBirthDate,
  validateName,
} from "@/lib/kid-validation";

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

export default function AddKidModal({ onClose, onSave }: AddKidModalProps) {
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [room, setRoom] = useState(ROOMS[0]);
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [touchedName, setTouchedName] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const birthDateInputRef = useRef<HTMLInputElement>(null);

  const nameError = touchedName ? validateName(name) : undefined;
  const dateError = touchedDate ? validateBirthDate(birthDate) : undefined;
  const valid =
    validateName(name) === undefined &&
    validateBirthDate(birthDate) === undefined &&
    ROOMS.includes(room);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valid) {
      setTouchedName(true);
      setTouchedDate(true);
      return;
    }
    onSave({
      name: name.trim(),
      birthDate: birthDate.trim(),
      room,
      allergies: allergies.trim(),
      notes: notes.trim(),
    });
  }

  function handleBirthDateChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const prevValue = birthDate;
    const prevCursor = input.selectionStart ?? prevValue.length;
    const formatted = formatBirthDateInput(input.value);

    // Preserve cursor when auto-inserting "/"
    let nextCursor = prevCursor;
    if (formatted.length > prevValue.length && formatted[prevCursor] === "/") {
      nextCursor = prevCursor + 1;
    } else if (formatted.length < prevValue.length) {
      // Deleting: if we removed a "/", step back
      if (prevValue[prevCursor - 1] === "/" && formatted.length < prevValue.length) {
        nextCursor = Math.max(0, prevCursor - 1);
      }
    }
    setBirthDate(formatted);
    requestAnimationFrame(() => {
      if (birthDateInputRef.current) {
        birthDateInputRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
    if (!touchedDate && formatted.length > 0) setTouchedDate(false);
  }

  function openDatePicker() {
    const picker = datePickerRef.current;
    if (!picker) return;
    try {
      if (typeof picker.showPicker === "function") {
        picker.showPicker();
      } else {
        picker.click();
      }
    } catch {
      picker.click();
    }
  }

  function handlePickerChange(event: ChangeEvent<HTMLInputElement>) {
    const iso = event.target.value;
    if (!iso) return;
    setBirthDate(formatISOToInput(iso));
    setTouchedDate(true);
    // Clear picker value so same date can be picked again if needed
    event.target.value = "";
  }

  const inputBase =
    "w-full rounded-[14px] border-[1.5px] bg-white px-4 py-[11px] text-[15px] text-ink outline-none placeholder:text-[#B6A99B] focus:border-coral";
  const inputDefault = "border-[#EADFD0]";
  const inputError = "border-[#E8B4A8] bg-[#FFF5F3] focus:border-[#E8B4A8]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 md:p-4"
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
        className="flex max-h-[min(85dvh,720px)] w-[min(520px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-line bg-[#FBF4EC] shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <header className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-line bg-[#FBF4EC] px-5 py-4 md:px-[26px] md:py-[20px]">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-[26px]">
          <div className="mb-3.5">
            <label
              htmlFor="kid-name"
              className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              NOMBRE COMPLETO
            </label>
            <input
              id="kid-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouchedName(true)}
              placeholder="Ej. Martina López"
              autoComplete="off"
              autoFocus
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "err-kid-name" : undefined}
              className={`${inputBase} ${nameError ? inputError : inputDefault}`}
            />
            {nameError ? (
              <p
                id="err-kid-name"
                role="alert"
                className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
              >
                {nameError}
              </p>
            ) : (
              <p className="mt-1.5 hidden text-[12px] leading-none" aria-hidden="true">
                &nbsp;
              </p>
            )}
          </div>

          <div className="mb-3.5 flex gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="kid-birthdate"
                className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
              >
                FECHA DE NACIMIENTO
              </label>
              <div className="relative">
                <input
                  ref={birthDateInputRef}
                  id="kid-birthdate"
                  type="text"
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  onBlur={() => setTouchedDate(true)}
                  placeholder="dd/mm/aaaa"
                  autoComplete="off"
                  inputMode="numeric"
                  aria-invalid={!!dateError}
                  aria-describedby={dateError ? "err-kid-birthdate" : undefined}
                  className={`${inputBase} pr-10 ${dateError ? inputError : inputDefault}`}
                />
                <button
                  type="button"
                  onClick={openDatePicker}
                  aria-label="Abrir calendario"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#B0A290] hover:bg-[#FBF4EC] hover:text-ink"
                >
                  <CalendarIcon className="h-[18px] w-[18px]" />
                </button>
                <input
                  ref={datePickerRef}
                  type="date"
                  tabIndex={-1}
                  aria-hidden="true"
                  max={todayISO()}
                  onChange={handlePickerChange}
                  className="sr-only"
                />
              </div>
              {dateError ? (
                <p
                  id="err-kid-birthdate"
                  role="alert"
                  className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
                >
                  {dateError}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="kid-room"
                className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
              >
                SALA
              </label>
              <div className="relative">
                <select
                  id="kid-room"
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  className="w-full appearance-none rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[11px] pr-10 text-[15px] font-bold text-ink outline-none focus:border-coral"
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

          <div className="mb-3.5">
            <label
              htmlFor="kid-allergies"
              className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              ALERGIAS (ETIQUETAS)
            </label>
            <input
              id="kid-allergies"
              type="text"
              value={allergies}
              onChange={(event) => setAllergies(event.target.value)}
              placeholder="Ej. Maní, Lactosa"
              autoComplete="off"
              className={`${inputBase} ${inputDefault}`}
            />
          </div>

          <div>
            <label
              htmlFor="kid-notes"
              className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              NOTAS MÉDICAS
            </label>
            <textarea
              id="kid-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Indicaciones, medicación, contactos…"
              rows={2}
              className={`${inputBase} resize-none leading-[1.5] md:resize-y ${inputDefault}`}
              style={{ minHeight: 72 }}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
