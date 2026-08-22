"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldAlert, Activity } from "lucide-react";
import clsx from "clsx";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/patent-cliffs", label: "Patent Cliffs", icon: ShieldAlert },
  { href: "/sentinel-health", label: "Sentinel Health", icon: Activity },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 glass-card !rounded-none flex flex-col">
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-primary">BioDrift</h1>
        <p className="text-xs text-on-surface-variant mt-1">Clinical Trial Sentinel</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-4 py-2.5 rounded-full text-sm font-medium transition-colors",
              pathname === href
                ? "bg-primary-container text-on-primary-container"
                : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-white/10 text-xs text-outline">
        v0.1.0 → Into the Scrape-Verse
      </div>
    </aside>
  );
}
