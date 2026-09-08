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
        quality={75}
        sizes="100vw"
        className="object-cover object-center scale-105"
      />
      <div className="absolute inset-0 bg-warm-50/72 dark:bg-warm-950/80" />
      <div className="absolute inset-0 bg-gradient-to-b from-orange-100/35 via-transparent to-amber-100/45 dark:from-warm-950/50 dark:via-warm-950/20 dark:to-warm-950/70" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.12),transparent_55%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(249,115,22,0.16),transparent_50%)]" />
    </div>
  );
}
