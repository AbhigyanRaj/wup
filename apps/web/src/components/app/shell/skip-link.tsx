export function SkipLink({ href = "#main" }: { href?: string }) {
  return (
    <a
      href={href}
      className="fixed left-3 top-3 z-[200] -translate-y-20 rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white shadow-btn-ink transition-transform duration-200 ease-standard focus-visible:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
    >
      Skip to content
    </a>
  );
}
