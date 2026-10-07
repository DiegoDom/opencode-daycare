import { LogoIcon } from "@/components/icons";
import ActivatePage from "@/components/pages/activate-account";
import { getActivationInvitation, type PrefilledValues } from "@/lib/activate";

export default async function ActivateAccountPage({
  searchParams,
}: PageProps<"/activate-account">) {
  const params = await searchParams;
  const code = typeof params.code === "string" ? params.code : undefined;
  const rawEmail = typeof params.email === "string" ? params.email : undefined;
  const email = rawEmail ? rawEmail.trim().toLowerCase() : undefined;

  const prefilled: PrefilledValues = { code, email };
  const firstStep = !(code && email);

  // Con `?email=` (con o sin `code`) la servidor resuelve la card del invitado
  // sin depender de un segundo round-trip del cliente. `getActivationInvitation`
  // lee con `service_role`: el padre que llega acá todavía no tiene sesión.
  let preview: { childName: string; daycareName: string } | undefined;
  if (email) {
    const invitation = await getActivationInvitation(email);
    if (invitation) {
      preview = { childName: invitation.childName, daycareName: invitation.daycareName };
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF4EC] p-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-[22px] flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-[linear-gradient(155deg,#F8C3A8,#F2937A)] shadow-[0_12px_26px_-10px_rgba(238,129,100,0.65)]">
          <LogoIcon className="h-[30px] w-[30px] text-white" />
        </div>
        <ActivatePage firstStep={firstStep} prefilled={prefilled} preview={preview} />
      </div>
    </div>
  );
}