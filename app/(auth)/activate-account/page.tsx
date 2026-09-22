import { LogoIcon } from "@/components/icons";
import ActivateAccountForm from "@/components/activate-account-form";

export default function ActivateAccountPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF4EC] p-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-[22px] flex h-[58px] w-[58px] items-center justify-center rounded-[18px] bg-[linear-gradient(155deg,#F8C3A8,#F2937A)] shadow-[0_12px_26px_-10px_rgba(238,129,100,0.65)]">
          <LogoIcon className="h-[30px] w-[30px] text-white" />
        </div>
        <ActivateAccountForm />
      </div>
    </div>
  );
}