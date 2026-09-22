"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { SearchIcon } from "./icons";

const DEBOUNCE_MS = 300;

export default function KidSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(() => searchParams.get("q") ?? "");
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams);

  if (searchParams !== prevSearchParams) {
    setPrevSearchParams(searchParams);
    setValue(searchParams.get("q") ?? "");
  }

  useEffect(() => {
    const q = value.trim();
    const committed = searchParams.get("q") ?? "";
    if (q === committed) return;

    const timer = setTimeout(() => {
      const next = q === "" ? pathname : `${pathname}?q=${encodeURIComponent(q)}`;
      router.replace(next, { scroll: false });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, pathname, router, searchParams]);

  return (
    <form
      action="/kids"
      method="get"
      role="search"
      className="mb-6 flex items-center gap-[11px] rounded-[14px] border border-line bg-card px-4 py-3"
    >
      <span className="flex-none text-[#B0A290]">
        <SearchIcon />
      </span>
      <input
        type="text"
        name="q"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar niño…"
        autoComplete="off"
        className="w-full flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-[#B6A99B]"
      />
    </form>
  );
}