import Image from "next/image";
import { HERO_IMAGE_ALT } from "@/lib/seo";

interface PageHeroProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  priority?: boolean;
}

export default function PageHero({ title, description, children, priority = false }: PageHeroProps) {
  return (
    <header className="relative pt-32 pb-20 overflow-hidden min-h-[480px] flex items-center">
      <div className="absolute inset-0" aria-hidden="true">
        <Image
          src="/bg.jpeg"
          alt={HERO_IMAGE_ALT}
          fill
          sizes="100vw"
          className="object-cover object-center"
          priority={priority}
          quality={75}
        />
        <div className="absolute inset-0 bg-slate-900/60 dark:bg-navy-950/80" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-5 tracking-tight">
          {title}
        </h1>
        <p className="text-slate-300 text-lg max-w-2xl mx-auto leading-relaxed">
          {description}
        </p>
        {children}
      </div>
    </header>
  );
}
