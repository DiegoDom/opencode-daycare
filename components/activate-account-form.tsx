import Link from "next/link";

import {
  activationDaycareShort,
  activationInitials,
  activateInputs,
  activateLabels,
} from "@/lib/activation-strings";
import type { PrefilledValues } from "@/lib/activate";

export interface InvitationPreview {
  childName: string;
  daycareName: string;
}

interface ActivateAccountFormProps {
  action: (payload: FormData) => void;
  pending: boolean;
  error?: string;
  prefilled: PrefilledValues;
  preview?: InvitationPreview;
  // Cuando el código llegó prefijado por el link se muestra en dos chips; un
  // error o el "deshacer" del usuario lo vuelve a un input editable.
  codeEditable: boolean;
  onUndoCode: () => void;
}

function CodeChip({ text, onUndo }: { text: string; onUndo: () => void }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[12px] border-[1.5px] border-[#EADFD0] bg-white px-3 py-[9px]">
      <span className="font-display text-[17px] font-bold tracking-[3px] text-ink">{text}</span>
      <button
        type="button"
        onClick={onUndo}
        aria-label={activateLabels.clearCode}
        className="grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-badge-coral-bg text-[13px] font-bold leading-none text-badge-coral"
      >
        ×
      </button>
    </span>
  );
}

export default function ActivateAccountForm({
  action,
  pending,
  error,
  prefilled,
  preview,
  codeEditable,
  onUndoCode,
}: ActivateAccountFormProps) {
  const code = prefilled.code ?? "";
  const groups = !codeEditable && code.length >= 6 ? [code.slice(0, 4), code.slice(4)] : null;
  const showCard = preview !== undefined;

  return (
    <form action={action} noValidate>
      <h1 className="font-display text-[32px] font-semibold leading-[1.15] text-ink">
        {activateLabels.title}
      </h1>
      <p className="mb-[26px] mt-2 text-[15.5px] leading-[1.55] text-muted">
        {activateLabels.step2Subtitle}
      </p>

      {showCard && (
        <div className="mb-[22px] flex items-center gap-[14px] rounded-[16px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px]">
          <div className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-full bg-[#A9D9E8] font-display text-[19px] font-semibold text-[#1F7A93]">
            {activationInitials(preview!.childName)}
          </div>
          <div>
            <div className="text-[13px] text-muted">{activateLabels.invitedBy}</div>
            <div className="font-display text-[17px] font-semibold text-ink">
              {preview!.childName} · {activationDaycareShort(preview!.daycareName)}
            </div>
          </div>
        </div>
      )}

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        {activateLabels.codeLabel}
      </div>
      {groups ? (
        <div className="mb-[18px] flex gap-[10px]">
          <input type="hidden" name={activateInputs.code.name} value={prefilled.code ?? ""} />
          <CodeChip text={groups[0]} onUndo={onUndoCode} />
          <CodeChip text={groups[1]} onUndo={onUndoCode} />
        </div>
      ) : (
        <input
          name={activateInputs.code.name}
          defaultValue={prefilled.code}
          autoComplete={activateInputs.code.autoComplete}
          inputMode="text"
          aria-label={activateLabels.codeLabel}
          className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] font-display text-[18px] font-bold tracking-[3px] text-ink"
        />
      )}

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        {activateLabels.emailLabel}
      </div>
      <input
        name={activateInputs.email.name}
        type={activateInputs.email.type}
        defaultValue={prefilled.email}
        autoComplete={activateInputs.email.autoComplete}
        placeholder={activateInputs.email.placeholder}
        aria-label={activateLabels.emailLabel}
        className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] text-[15px] text-ink placeholder:text-[#B6A99B]"
      />

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        {activateLabels.passwordLabel}
      </div>
      <input
        name={activateInputs.password.name}
        type={activateInputs.password.type}
        autoComplete={activateInputs.password.autoComplete}
        aria-label={activateLabels.passwordLabel}
        className="mb-[18px] w-full rounded-[14px] border-[1.5px] border-[#F2A78E] bg-white px-4 py-[14px] text-[15px] text-ink"
      />

      <div className="mb-2 text-[12px] font-bold tracking-[0.7px] text-muted">
        {activateLabels.confirmationLabel}
      </div>
      <input
        name={activateInputs.confirmation.name}
        type={activateInputs.confirmation.type}
        autoComplete={activateInputs.confirmation.autoComplete}
        aria-label={activateLabels.confirmationLabel}
        className="mb-6 w-full rounded-[14px] border-[1.5px] border-[#EADFD0] bg-white px-4 py-[14px] text-[15px] text-ink"
      />

      <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-[14px] bg-[#FBF1D6] px-4 py-[14px]">
        <input
          type="checkbox"
          required
          defaultChecked
          className="mt-[1px] h-6 w-6 flex-none cursor-pointer accent-[#5FB97E]"
          aria-label={activateLabels.agreement}
        />
        <span className="text-[14px] leading-[1.45] text-[#8A7234]">{activateLabels.agreement}</span>
      </label>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-[12px] bg-badge-coral-bg px-4 py-[11px] text-[13.5px] font-semibold text-badge-coral"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="block w-full cursor-pointer rounded-[15px] bg-gradient-to-b from-peach to-coral py-[15px] text-center text-[16px] font-extrabold text-white shadow-[0_10px_22px_-8px_rgba(238,129,100,0.7)] disabled:cursor-progress disabled:opacity-70"
      >
        {activateLabels.step2Cta}
      </button>

      <p className="mt-[22px] text-center text-[14.5px] text-muted">
        {activateLabels.alreadyAccount}{" "}
        <Link
          href="/login"
          className="cursor-pointer font-extrabold text-terracotta-deep"
        >
          {activateLabels.login}
        </Link>
      </p>
    </form>
  );
}