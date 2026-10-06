import { LogoIcon } from "@/components/icons";
import LoginForm from "@/components/login-form";
import { getCurrentUser, safeRedirectPath } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(
    typeof params.next === "string" ? params.next : undefined,
  );
  const notice =
    typeof params.error === "string" && params.error === "pending"
      ? "Tu cuenta aún no está activada. Contactá a la guardería para activarla."
      : undefined;

  const user = await getCurrentUser();
  if (user?.status === "active") {
    redirect(next);
  }

  return (
    <div className="grid min-h-screen bg-[#FBF4EC] lg:grid-cols-[1.05fr_1fr]">
      <div className="flex items-center gap-[13px] px-6 pb-5 pt-7 lg:hidden">
        <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-gradient-to-b from-peach to-coral text-white">
          <LogoIcon className="h-[26px] w-[26px]" />
        </div>
        <span className="font-display text-[21px] font-semibold tracking-[0.5px] text-ink">
          OpenDayCare
        </span>
      </div>

      <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(155deg,#F6A98E_0%,#F2937A_45%,#EC7E62_100%)] px-[60px] py-14 text-white lg:flex">
        <div className="absolute -right-[120px] -top-[140px] h-[420px] w-[420px] rounded-full bg-white/[0.12]" />
        <div className="absolute -bottom-[110px] -left-[80px] h-[300px] w-[300px] rounded-full bg-white/[0.10]" />

        <div className="relative flex items-center gap-[13px]">
          <div className="flex h-[46px] w-[46px] items-center justify-center rounded-[14px] bg-white/20">
            <LogoIcon className="h-[26px] w-[26px] text-white" />
          </div>
          <span className="font-display text-[21px] font-semibold tracking-[0.5px]">
            OpenDayCare
          </span>
        </div>

        <div className="relative">
          <h1 className="mb-[18px] font-display text-[42px] font-semibold leading-[1.12]">
            El día de cada niño,
            <br />
            compartido con su familia.
          </h1>
          <p className="max-w-[430px] text-[17px] leading-[1.6] text-white/[0.92]">
            Publicá momentos, gestioná las salas y mantené a las familias cerca,
            desde un solo lugar.
          </p>
        </div>

        <div className="relative text-sm text-white/90">
          🌿 Guardería Sala Soles
        </div>
      </div>

      <div className="flex items-center justify-center p-10">
        <div className="w-full max-w-[392px]">
          {notice && (
            <p
              role="alert"
              className="mb-6 rounded-[12px] bg-badge-coral-bg px-4 py-[11px] text-[13.5px] font-semibold text-badge-coral"
            >
              {notice}
            </p>
          )}
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}