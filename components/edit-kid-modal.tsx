"use client";

import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { CalendarIcon } from "./icons";
import { updateKidAction } from "@/lib/kids-actions";
import type { Kid, Room } from "@/lib/kids";
import {
  formatBirthDateInput,
  formatISOToInput,
  todayISO,
  validateBirthDate,
  validateName,
} from "@/lib/kid-validation";

interface EditKidModalProps {
  kid: Kid;
  rooms: Room[];
  onClose: () => void;
}

function parseSpanishDateToISO(input: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
  if (m) {
    const [, d, mo, y] = m;
    const date = new Date(Number(y), Number(mo) - 1, Number(d));
    if (
      date.getFullYear() !== Number(y) ||
      date.getMonth() !== Number(mo) - 1 ||
      date.getDate() !== Number(d)
    )
      return null;
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  const m2 = /^(\d{1,2})\s+([a-záéíóúñ]+)\s+(\d{4})$/i.exec(input.trim());
  if (m2) {
    const [, d, moStr, y] = m2;
    const MONTHS: Record<string, string> = {
      ene: "01",
      feb: "02",
      mar: "03",
      abr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      ago: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dic: "12",
    };
    const key = moStr.toLowerCase().slice(0, 3);
    const mm = MONTHS[key];
    if (mm) {
      const date = new Date(Number(y), Number(mm) - 1, Number(d));
      if (
        date.getFullYear() !== Number(y) ||
        date.getMonth() !== Number(mm) - 1 ||
        date.getDate() !== Number(d)
      )
        return null;
      return `${y}-${mm}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

function isoToSpanish(iso: string): string {
  if (!iso) return "";
  const parts = iso.split("-");
  if (parts.length !== 3) return "";
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export default function EditKidModal({ kid, rooms, onClose }: EditKidModalProps) {
  const router = useRouter();
  const [name, setName] = useState(kid.name);
  const [birthDate, setBirthDate] = useState(() => {
    const iso = parseSpanishDateToISO(kid.birthDate);
    return iso ? isoToSpanish(iso) : kid.birthDate;
  });
  const [room, setRoom] = useState(kid.room || rooms[0]?.name || "");
  const [allergies, setAllergies] = useState(() =>
    kid.badge?.label ? kid.badge.label : "",
  );
  const [notes, setNotes] = useState(kid.note?.text ?? "");
  const [touchedName, setTouchedName] = useState(false);
  const [touchedDate, setTouchedDate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const birthDateInputRef = useRef<HTMLInputElement>(null);

  const nameError = touchedName ? validateName(name) : undefined;
  const dateError = touchedDate ? validateBirthDate(birthDate) : undefined;
  const valid =
    validateName(name) === undefined &&
    validateBirthDate(birthDate) === undefined &&
    rooms.some((value) => value.name === room);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  function handleFormKeyDown(event: ReactKeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter") return;
    const el = event.target as HTMLInputElement;
    if (el.tagName !== "INPUT" || el.type !== "text") return;
    if (!valid) {
      setTouchedName(true);
      setTouchedDate(true);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!valid) {
      setTouchedName(true);
      setTouchedDate(true);
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateKidAction({
      id: kid.id,
      name: name.trim(),
      birthDate: birthDate.trim(),
      room,
      allergies: allergies.trim(),
      notes: notes.trim(),
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  function handleBirthDateChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const prevValue = birthDate;
    const prevCursor = input.selectionStart ?? prevValue.length;
    const formatted = formatBirthDateInput(input.value);

    let nextCursor = prevCursor;
    if (formatted.length > prevValue.length && formatted[prevCursor] === "/") {
      nextCursor = prevCursor + 1;
    } else if (formatted.length < prevValue.length) {
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
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        noValidate
        onSubmit={handleSubmit}
        onKeyDown={handleFormKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Editar niño"
        className="flex max-h-[min(85dvh,720px)] w-[min(520px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-line bg-[#FBF4EC] shadow-[0_20px_50px_-24px_rgba(63,54,46,0.35)]"
      >
        <header className="sticky top-0 z-10 flex flex-none items-center justify-between border-b border-line bg-[#FBF4EC] px-5 py-4 md:px-[26px] md:py-[20px]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="text-[15px] font-bold text-muted disabled:opacity-50"
          >
            Cancelar
          </button>
          <span className="font-display text-[18px] font-semibold text-ink">
            Editar niño
          </span>
          <button
            type="submit"
            disabled={!valid || saving}
            aria-busy={saving}
            className="text-[15px] font-extrabold text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-[26px]">
          {error && (
            <p
              role="alert"
              className="mb-3.5 rounded-[12px] bg-badge-coral-bg px-4 py-[11px] text-[13.5px] font-semibold text-badge-coral"
            >
              {error}
            </p>
          )}
          <div className="mb-3.5">
            <label
              htmlFor="kid-name-edit"
              className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              NOMBRE COMPLETO
            </label>
            <input
              id="kid-name-edit"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() => setTouchedName(true)}
              placeholder="Ej. Martina López"
              autoComplete="off"
              autoFocus
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "err-kid-name-edit" : undefined}
              className={`${inputBase} ${nameError ? inputError : inputDefault}`}
            />
            {nameError ? (
              <p
                id="err-kid-name-edit"
                role="alert"
                className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
              >
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="mb-3.5 flex gap-3">
            <div className="min-w-0 flex-1">
              <label
                htmlFor="kid-birthdate-edit"
                className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
              >
                FECHA DE NACIMIENTO
              </label>
              <div className="relative">
                <input
                  ref={birthDateInputRef}
                  id="kid-birthdate-edit"
                  type="text"
                  value={birthDate}
                  onChange={handleBirthDateChange}
                  onBlur={() => setTouchedDate(true)}
                  placeholder="dd/mm/aaaa"
                  autoComplete="off"
                  inputMode="numeric"
                  aria-invalid={!!dateError}
                  aria-describedby={dateError ? "err-kid-birthdate-edit" : undefined}
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
                  id="err-kid-birthdate-edit"
                  role="alert"
                  className="mt-1.5 text-[12px] font-semibold leading-none text-terracotta"
                >
                  {dateError}
                </p>
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="kid-room-edit"
                className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
              >
                SALA
              </label>
              <div className="relative">
                <select
                  id="kid-room-edit"
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  className="w-full appearance-none rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[11px] pr-10 text-[15px] font-bold text-ink outline-none focus:border-coral"
                >
                  {rooms.map((value) => (
                    <option key={value.id} value={value.name}>
                      {value.name}
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
              htmlFor="kid-allergies-edit"
              className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              ALERGIAS (ETIQUETAS)
            </label>
            <input
              id="kid-allergies-edit"
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
              htmlFor="kid-notes-edit"
              className="mb-[6px] block text-[12px] font-extrabold tracking-[0.7px] text-muted"
            >
              NOTAS MÉDICAS
            </label>
            <textarea
              id="kid-notes-edit"
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
