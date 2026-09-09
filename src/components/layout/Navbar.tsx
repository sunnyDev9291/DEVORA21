"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAV_LINKS } from "@/lib/constants";
import { brand } from "@/lib/ui-styles";
import ThemeToggle from "@/components/ui/ThemeToggle";
import NavbarActions from "@/components/layout/NavbarActions";

function navLinkClass(pathname: string, href: string) {
  const isActive = pathname === href;

  return isActive
    ? "text-orange-800 dark:text-orange-300 bg-orange-500/10"
    : "text-stone-800 dark:text-stone-100 hover:text-stone-950 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-white/[0.05]";
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
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,box-shadow,border-color] duration-300 [transform:translateZ(0)] bg-white/95 dark:bg-warm-950/95 backdrop-blur-md border-b ${
        scrolled
          ? "border-orange-200/80 dark:border-orange-500/20 shadow-gloss dark:shadow-card-dark"
          : "border-orange-200/70 dark:border-orange-500/15"
      }`}
    >
      <nav aria-label="Main navigation" className="w-full px-3 sm:px-4 lg:px-5">
        {/* Mobile / tablet */}
        <div className="flex h-16 items-center justify-between gap-3 xl:hidden">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Devora21 home">
            <Image
              src="/logo.png"
              alt="Devora21 logo"
              width={64}
              height={64}
              className="h-auto w-14 object-contain"
              priority
            />
            <span className={`font-display text-xl font-extrabold tracking-tight ${brand.gradientText}`}>
              Devora21
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="rounded-lg p-2 text-stone-800 transition-colors hover:bg-stone-100 hover:text-stone-950 dark:text-stone-100 dark:hover:bg-white/[0.05] dark:hover:text-white"
              aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-nav-menu"
            >
              {isOpen ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/*
          Desktop zones:
          - Left: logo
          - Center: nav links + theme + Resume / Live Interview
          - Far right edge: profile, Sign out, Book Call
        */}
        <div className="relative hidden h-20 items-center xl:flex">
          <Link href="/" className="relative z-20 flex shrink-0 items-center gap-2.5" aria-label="Devora21 home">
            <Image
              src="/logo.png"
              alt="Devora21 logo"
              width={72}
              height={72}
              className="h-auto w-[68px] object-contain"
              priority
            />
            <span className={`font-display text-2xl font-extrabold tracking-tight ${brand.gradientText}`}>
              Devora21
            </span>
          </Link>

          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-48 2xl:px-56">
            <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 2xl:gap-3">
              <ul className="m-0 flex list-none flex-nowrap items-center gap-0.5 p-0 2xl:gap-1" role="list">
                {NAV_LINKS.map((link) => (
                  <li key={link.href} className="shrink-0">
                    <Link
                      href={link.href}
                      aria-current={pathname === link.href ? "page" : undefined}
                      className={`rounded-xl px-2.5 py-2 text-sm font-medium whitespace-nowrap transition-all duration-150 2xl:px-3.5 ${navLinkClass(pathname, link.href)}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <ThemeToggle />
              <NavbarActions variant="desktop" zone="tools" />
            </div>
          </div>

          <div className="relative z-20 ml-auto flex shrink-0 items-center justify-end pl-4">
            <NavbarActions variant="desktop" zone="account" />
          </div>
        </div>
      </nav>

      <div
        id="mobile-nav-menu"
        className={`overflow-hidden transition-all duration-300 xl:hidden ${
          isOpen ? "max-h-[90vh] opacity-100 overflow-y-auto" : "max-h-0 opacity-0"
        }`}
        aria-hidden={!isOpen}
      >
        <nav aria-label="Mobile navigation" className="border-b border-white/[0.06] bg-warm-950/98 px-4 py-4 backdrop-blur-md">
          <ul className="m-0 list-none space-y-1 p-0" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? "bg-orange-500/10 text-orange-300"
                      : "text-stone-200 hover:bg-white/[0.05] hover:text-white"
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
