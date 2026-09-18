import type { ReactNode } from "react";

export default function EmptyScene({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="relative mt-8 overflow-hidden rounded-2xl bg-[#16120b]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(232,197,71,0.28) 1px, transparent 1px), linear-gradient(90deg, rgba(232,197,71,0.28) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="pointer-events-none absolute -top-16 -left-10 h-48 w-48 rounded-full bg-[#e8c547]/16 blur-3xl" />
      <div className="pointer-events-none absolute -right-8 -bottom-20 h-56 w-56 rounded-full bg-[#c6a35a]/14 blur-3xl" />
      <EmptyArt />
      <div className="relative px-6 py-16 text-center md:py-[76px]">
        <div className="text-[22px] font-semibold tracking-[-0.02em] text-white">{title}</div>
        <p className="mx-auto mt-2 max-w-[44ch] text-[15px] leading-relaxed text-white/55">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}

function EmptyArt() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 280"
      fill="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="g-lite" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6e7a4" />
          <stop offset="100%" stopColor="#c6a35a" />
        </linearGradient>
        <linearGradient id="g-mid" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8c547" />
          <stop offset="100%" stopColor="#7a5a1c" />
        </linearGradient>
        <linearGradient id="g-deep" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#c6a35a" />
          <stop offset="100%" stopColor="#3f2f10" />
        </linearGradient>
      </defs>
      <g opacity="0.78" transform="translate(-10 36)">
        <polygon points="110,168 62,140 110,112 158,140" fill="url(#g-lite)" />
        <polygon points="62,140 62,188 110,216 110,168" fill="url(#g-deep)" />
        <polygon points="110,168 110,216 158,188 158,140" fill="url(#g-mid)" />
        <polygon points="188,92 164,78 188,64 212,78" fill="url(#g-lite)" />
        <polygon points="164,78 164,102 188,116 188,92" fill="url(#g-deep)" />
        <polygon points="188,92 188,116 212,102 212,78" fill="url(#g-mid)" />
        <polygon points="48,78 18,118 48,158 78,118" fill="url(#g-mid)" />
        <polygon points="48,78 78,118 48,118" fill="url(#g-lite)" />
        <polygon points="48,118 18,118 48,158" fill="url(#g-deep)" />
        <path d="M214 186h70l18 18H196z" fill="url(#g-lite)" opacity="0.85" />
        <path d="M196 204h106v28H178z" fill="url(#g-deep)" />
        <path d="M284 186v18l-18 28v-28z" fill="url(#g-mid)" />
      </g>
      <g opacity="0.74" transform="translate(892 8)">
        <polygon points="168,48 120,20 168,-8 216,20" fill="url(#g-lite)" />
        <polygon points="120,20 120,68 168,96 168,48" fill="url(#g-deep)" />
        <polygon points="168,48 168,96 216,68 216,20" fill="url(#g-mid)" />
        <polygon points="86,150 56,190 86,230 116,190" fill="url(#g-mid)" />
        <polygon points="86,150 116,190 86,190" fill="url(#g-lite)" />
        <polygon points="86,190 56,190 86,230" fill="url(#g-deep)" />
        <path d="M28 72h64l16 16H12z" fill="url(#g-lite)" />
        <path d="M12 88h96v24H-4z" fill="url(#g-deep)" />
        <path d="M92 72v16l-16 24V88z" fill="url(#g-mid)" />
        <circle cx="246" cy="168" r="34" stroke="url(#g-lite)" strokeWidth="10" fill="none" />
        <circle cx="246" cy="168" r="18" stroke="url(#g-mid)" strokeWidth="6" fill="none" />
      </g>
    </svg>
  );
}
