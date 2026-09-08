import Image from "next/image";

/**
 * Fixed scenic backdrop shared by every page.
 * Kept behind content via -z-10; overlays keep text readable.
 */
export default function SiteBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <Image
        src="/images/site-nature-bg.png"
        alt=""
        fill
        priority
        quality={80}
        sizes="100vw"
        className="object-cover object-center scale-105"
      />
      {/* Lighter wash so the landscape stays visible under content */}
      <div className="absolute inset-0 bg-warm-50/45 dark:bg-warm-950/62" />
      <div className="absolute inset-0 bg-gradient-to-b from-orange-50/25 via-transparent to-amber-100/40 dark:from-warm-950/35 dark:via-warm-950/15 dark:to-warm-950/55" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(251,146,60,0.18),transparent_42%),radial-gradient(ellipse_at_85%_100%,rgba(251,191,36,0.14),transparent_40%)]" />
    </div>
  );
}
