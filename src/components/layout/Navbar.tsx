"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NavbarActions from "@/components/layout/NavbarActions";

function navLinkClass(pathname: string, href: string, overlay: boolean) {
  const isActive = pathname === href;

  if (overlay) {
    return isActive
      ? "text-orange-300 bg-white/15 shadow-sm shadow-black/20"
      : "text-stone-100 hover:text-white hover:bg-white/10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]";
  }

  return isActive
    ? "text-orange-700 dark:text-orange-300 bg-orange-500/10"
    : "text-stone-700 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/[0.05]";
}

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 20);
        ticking = false;
      });
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <header
      data-nav-overlay={!scrolled}
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 [transform:translateZ(0)] ${
        scrolled
          ? "bg-white/82 dark:bg-warm-950/84 border-b border-orange-200/60 dark:border-orange-500/10 shadow-gloss dark:shadow-card-dark backdrop-blur-md"
          : "bg-transparent border-b border-transparent shadow-none"
      }`}
    >
      <nav
        aria-label="Main navigation"
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex items-center gap-2.5 pt-6 pb-3 px-2 shrink-0" aria-label="Devora21 home">
            <Image
              src="/logo.png"
              alt="Devora21 logo"
              width={72}
              height={72}
              className="w-[72px] h-auto object-contain"
              priority
            />
            <span className="font-display text-2xl font-extrabold bg-gradient-to-r from-tomato-600 via-orange-500 to-sun-400 bg-clip-text text-transparent tracking-tight dark:from-tomato-400 dark:via-orange-400 dark:to-sun-300">
              Devora21
            </span>
          </Link>

          <ul className="hidden lg:flex items-center gap-0.5 xl:gap-1 list-none m-0 p-0 mx-4" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`px-3 xl:px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 whitespace-nowrap ${navLinkClass(pathname, link.href, !scrolled)}`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            <ThemeToggle overlay={!scrolled} />
            <NavbarActions variant="desktop" overlay={!scrolled} />
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle overlay={!scrolled} />
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className={`p-2 rounded-lg transition-colors ${
                !scrolled
                  ? "text-stone-100 hover:text-white hover:bg-white/10 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
                  : "text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/[0.05]"
              }`}
              aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-nav-menu"
            >
              {isOpen ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </nav>

      <div
        id="mobile-nav-menu"
        className={`lg:hidden overflow-hidden transition-all duration-300 ${
          isOpen ? "max-h-[90vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <nav aria-label="Mobile navigation" className="bg-warm-950/98 backdrop-blur-md border-b border-white/[0.06] px-4 py-4">
          <ul className="space-y-1 list-none m-0 p-0" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "text-orange-400 bg-orange-500/10"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <NavbarActions variant="mobile" onNavigate={() => setIsOpen(false)} />
        </nav>
      </div>
    </header>
  );
}
