"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Home" },
  { href: "/transactions/new", label: "Add", center: true },
  { href: "/transactions", label: "Activity" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-soft/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-around px-6 py-2">
        {items.map((item) => {
          const active = pathname === item.href;
          if (item.center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-2xl leading-none text-white shadow-lg">
                  +
                </span>
                <span className="mt-0.5 text-[11px] text-white/60">
                  {item.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center px-3 py-1 text-xs ${
                active ? "text-brand-soft" : "text-white/55"
              }`}
            >
              <span className="text-lg leading-none">
                {item.label === "Home" ? "◉" : "☰"}
              </span>
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
