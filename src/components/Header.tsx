import { Link, useLocation } from "@tanstack/react-router";
import { Scale, Home, Network, Settings } from "lucide-react";

const NAV = [
  { to: "/", label: "Stories", icon: Home, exact: true },
  { to: "/entities", label: "Entities", icon: Network, exact: false },
] as const;

export function Header() {
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");

  return (
    <header className="sticky top-0 z-50 border-b border-ink-800 bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-500/15 ring-1 ring-accent-500/30 transition-transform group-hover:scale-105">
            <Scale className="h-5 w-5 text-accent-400" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif text-base font-semibold text-ink-50">
              Accountability Engine
            </span>
            <span className="text-[10px] uppercase tracking-widest text-ink-400">
              De-Spun News
            </span>
          </div>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? pathname === to : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-ink-800 text-ink-50"
                    : "text-ink-400 hover:bg-ink-800/50 hover:text-ink-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isAdmin
                ? "bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/30"
                : "text-ink-400 hover:bg-ink-800/50 hover:text-ink-100"
            }`}
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
