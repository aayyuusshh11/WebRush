import type { ReactNode } from "react";

interface Props {
  eyebrow: string;
  title: ReactNode;
  lede?: string;
}

/** Quiet editorial section opener: label, big serif title, optional lede. */
export default function SectionHeader({ eyebrow, title, lede }: Props) {
  return (
    <header className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      <p className="label">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl leading-[1.04] text-paper sm:text-5xl md:text-6xl">
        {title}
      </h2>
      {lede && (
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-faded sm:text-base">
          {lede}
        </p>
      )}
    </header>
  );
}
