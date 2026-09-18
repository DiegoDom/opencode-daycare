interface FeedHeaderProps {
  roomLabel: string;
  greeting: string;
  childrenLine: string;
}

export default function FeedHeader({ roomLabel, greeting, childrenLine }: FeedHeaderProps) {
  return (
    <div className="mb-6">
      <div className="text-[12.5px] font-extrabold tracking-[0.8px] text-terracotta">
        {roomLabel}
      </div>
      <h1 className="font-display text-[30px] font-semibold text-ink">{greeting}</h1>
      <p className="mt-[5px] text-[14.5px] text-muted">{childrenLine}</p>
    </div>
  );
}