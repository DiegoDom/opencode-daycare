interface SectionDividerProps {
  label: string;
}

export default function SectionDivider({ label }: SectionDividerProps) {
  return (
    <div className="mb-[14px] flex items-center gap-[14px]">
      <span className="text-[12.5px] font-extrabold tracking-[0.8px] text-[#8A7C6D]">
        {label}
      </span>
      <span className="h-[1px] flex-1 bg-[#E7DAC8]" />
    </div>
  );
}