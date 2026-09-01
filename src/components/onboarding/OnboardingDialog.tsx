"use client";

interface OnboardingDialogProps {
  children: React.ReactNode;
}

/** Full-screen LinkedIn-style overlay: dimmed backdrop + centered board. */
export default function OnboardingDialog({ children }: OnboardingDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-warm-950/95 px-4 py-8 backdrop-blur-sm sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.14),_transparent_55%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {children}
      </div>
    </div>
  );
}
