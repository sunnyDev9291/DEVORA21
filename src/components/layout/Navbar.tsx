"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NavbarActions from "@/components/layout/NavbarActions";

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
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 [transform:translateZ(0)] ${
        scrolled
          ? "bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-white/[0.06] shadow-xl shadow-black/10 dark:shadow-black/20"
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
            <span className="text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-violet-600 bg-clip-text text-transparent tracking-tight">
              Devora21
            </span>
          </Link>

          <ul className="hidden lg:flex items-center gap-0.5 xl:gap-1 list-none m-0 p-0 mx-4" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`px-3 xl:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap ${
                    pathname === link.href
                      ? "text-blue-600 dark:text-blue-400 bg-blue-500/10"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden lg:flex items-center gap-2 xl:gap-3 shrink-0">
            <ThemeToggle />
            <NavbarActions variant="desktop" />
          </div>

          <div className="lg:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
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
        <nav aria-label="Mobile navigation" className="bg-navy-950/98 backdrop-blur-md border-b border-white/[0.06] px-4 py-4">
          <ul className="space-y-1 list-none m-0 p-0" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "text-blue-400 bg-blue-500/10"
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
