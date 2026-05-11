"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

export function Navbar() {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={clsx(
        "text-sm transition-colors",
        pathname === href
          ? "text-brand font-medium"
          : "text-gray-500 hover:text-gray-900"
      )}
    >
      {label}
    </Link>
  );

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-black/[0.06]">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-baseline gap-2 group">
          <span className="font-serif text-xl text-brand leading-none">Briefd</span>
          <span className="text-[11px] text-gray-400 tracking-wide hidden sm:inline">
            your daily signal
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-5">
          {navLink("/", "Today")}
          {navLink("/algorithm", "My Algorithm")}
          {navLink("/settings", "Settings")}
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  );
}
