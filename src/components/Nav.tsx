import { motion, useScroll, useSpring } from "framer-motion";

const LINKS: Array<[string, string]> = [
  ["The Record", "record"],
  ["Patterns", "patterns"],
  ["Chapters", "chapters"],
  ["Archive", "archive"],
  ["Method", "method"],
];

export default function Nav() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 top-0 z-50 border-b border-line/60 bg-ink/85 backdrop-blur-sm"
    >
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px origin-left bg-accent/70"
        style={{ scaleX }}
      />
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <a
          href="#top"
          className="font-display text-xl tracking-wide text-paper transition-colors hover:text-accent"
        >
          TRACE
          <span className="ml-2 hidden align-middle font-ui text-[10px] uppercase tracking-[0.22em] text-mute sm:inline">
            a life, in receipts
          </span>
        </a>
        <ul className="flex items-center gap-1 overflow-x-auto sm:gap-2">
          {LINKS.map(([label, id]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="block whitespace-nowrap px-2.5 py-1.5 text-[11px] uppercase tracking-[0.16em] text-faded transition-colors hover:text-accent"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
