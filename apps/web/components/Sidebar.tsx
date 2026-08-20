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
    <aside className="w-64 bg-bio-800 border-r border-bio-600 flex flex-col">
      <div className="p-6 border-b border-bio-600">
        <h1 className="text-xl font-bold text-bio-300">BioDrift</h1>
        <p className="text-xs text-gray-400 mt-1">Clinical Trial Sentinel</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
              pathname === href
                ? "bg-bio-600 text-bio-300"
                : "text-gray-400 hover:bg-bio-700 hover:text-gray-200"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-bio-600 text-xs text-gray-500">
        v0.1.0 → Into the Scrape-Verse
      </div>
    </aside>
  );
}
