"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { useEffect, useState } from "react";

function formatNavDate(): string {
  const now = new Date();
  const day  = now.toLocaleDateString("en-MY", { weekday: "long" }).toUpperCase();
  const d    = now.getDate();
  const mon  = now.toLocaleDateString("en-MY", { month: "long" }).toUpperCase();
  const yr   = now.getFullYear();
  return `${day} · ${d} ${mon} ${yr} · KUALA LUMPUR`;
}

export function Navbar() {
  const pathname      = usePathname();
  const router        = useRouter();
  const [dateStr,     setDateStr]     = useState("");
  const [menuOpen,    setMenuOpen]    = useState(false);

  useEffect(() => { setDateStr(formatNavDate()); }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const navLinks = [
    { href: "/digest",    label: "TODAY'S DIGEST" },
    { href: "/algorithm", label: "MY ALGORITHM"   },
    { href: "/archive",   label: "ARCHIVE"        },
    { href: "/settings",  label: "SETTINGS"       },
  ];

  return (
    <nav
      className="animate-slideDown sticky top-0 z-50 bg-white"
      style={{ borderTop: "2px solid #0F0E0C", borderBottom: "3px solid #0F0E0C" }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Main row */}
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/digest" className="flex flex-col justify-center">
            <span
              style={{
                fontFamily: "var(--font-playfair), Georgia, serif",
                fontSize: "24px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "#0F0E0C",
                lineHeight: 1,
                textTransform: "uppercase",
              }}
            >
              BRIEFD
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "transition-colors",
                  "hover:text-[#1D5C3A]"
                )}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "11px",
                  fontVariant: "small-caps",
                  letterSpacing: "0.06em",
                  color: pathname === href ? "#1D5C3A" : "#5C5750",
                  fontWeight: pathname === href ? 500 : 400,
                }}
              >
                {label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "11px",
                fontVariant: "small-caps",
                letterSpacing: "0.06em",
                color: "#9C9890",
              }}
              className="hover:text-[#0F0E0C] transition-colors"
            >
              SIGN OUT
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <div className="w-5 flex flex-col gap-1">
              <span
                className="block h-px bg-[#0F0E0C] transition-all"
                style={{ transform: menuOpen ? "rotate(45deg) translateY(6px)" : "none" }}
              />
              <span
                className="block h-px bg-[#0F0E0C] transition-all"
                style={{ opacity: menuOpen ? 0 : 1 }}
              />
              <span
                className="block h-px bg-[#0F0E0C] transition-all"
                style={{ transform: menuOpen ? "rotate(-45deg) translateY(-6px)" : "none" }}
              />
            </div>
          </button>
        </div>

        {/* Date sub-row — desktop only */}
        {dateStr && (
          <div
            className="hidden md:block pb-1.5 text-center"
            style={{
              fontFamily: "var(--font-dm-mono), monospace",
              fontSize: "10px",
              letterSpacing: "0.08em",
              color: "#9C9890",
              borderTop: "1px solid rgba(0,0,0,0.1)",
              paddingTop: "4px",
            }}
          >
            {dateStr}
          </div>
        )}
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t border-[rgba(0,0,0,0.12)] bg-white"
          style={{ borderTop: "1px solid rgba(0,0,0,0.12)" }}
        >
          <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-4">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                style={{
                  fontFamily: "var(--font-dm-mono), monospace",
                  fontSize: "13px",
                  fontVariant: "small-caps",
                  letterSpacing: "0.06em",
                  color: pathname === href ? "#1D5C3A" : "#0F0E0C",
                }}
              >
                {label}
              </Link>
            ))}
            <button
              onClick={handleSignOut}
              className="text-left"
              style={{
                fontFamily: "var(--font-dm-mono), monospace",
                fontSize: "13px",
                fontVariant: "small-caps",
                letterSpacing: "0.06em",
                color: "#9C9890",
              }}
            >
              SIGN OUT
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
