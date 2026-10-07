"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { session, api, today } from "@/lib/api";
import { useToast } from "./ui";

export const Logo = ({ size = 40 }: { size?: number }) => (
  <Image
    src="/logo.jpg"
    alt="ACM SIGGRAPH"
    width={size}
    height={size}
    className="rounded-lg object-contain"
    style={{ width: size, height: "auto" }}
    priority
  />
);

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/teams", "Teams"],
  ["/attendance", "Attendance"],
  ["/movements", "Room Movement"],
  ["/club", "Club Members"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
];

export function ExportButton({
  date,
  label = "Export Excel",
}: {
  date?: string;
  label?: string;
}) {
  const [b, setB] = useState(false);
  const toast = useToast();
  return (
    <button
      className="btn"
      disabled={b}
      onClick={async () => {
        setB(true);
        try {
          await api.exportXlsx(date);
        } catch (e) {
          toast((e as Error).message, false);
        }
        setB(false);
      }}
    >
      {b ? "Exporting..." : `📥 ${label}`}
    </button>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const r = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [ok, setOk] = useState(false);
  const [admin, setAdmin] = useState<{ name: string; email: string } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const t = session.token();
    if (!t) {
      window.location.href = "/login";
    } else {
      setAdmin(session.admin());
      setOk(true);
    }
  }, [path]);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    // Check if already running in standalone mode (PWA)
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        toast("App installed successfully!", true);
      }
      setDeferredPrompt(null);
    } else {
      toast("To install app: Open Chrome menu (⋮) -> 'Install App' or 'Add to Home screen'", true);
    }
  };

  if (!ok) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-white/70">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-4" />
        <p className="text-sm font-medium">Authenticating Admin Session...</p>
      </div>
    );
  }

  const side = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 p-4">
        <Logo />
        <span className="font-semibold leading-tight">
          ACM SIGGRAPH
          <br />
          <span className="text-xs font-normal text-white/50">Hackathon Attendance</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {NAV.map(([h, l]) => (
          <Link
            key={h}
            href={h}
            className={`block rounded-lg px-3 py-2 text-sm transition-all ${
              path.startsWith(h)
                ? "bg-orange-500 text-black font-semibold shadow-md shadow-orange-500/20"
                : "text-white/70 hover:bg-white/5"
            }`}
          >
            {l}
          </Link>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4 space-y-3">
        {!isStandalone && (
          <button
            onClick={handleInstallClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 px-3 py-2 text-xs font-medium text-orange-400 transition-all"
          >
            📲 Install App (Chrome)
          </button>
        )}
        <div>
          <p className="truncate text-sm font-medium">{admin?.name ?? "Admin"}</p>
          <p className="truncate text-xs text-white/50">{admin?.email ?? "admin@siggraph.acm.org"}</p>
        </div>
        <button
          className="btn-ghost w-full !text-red-400 hover:!bg-red-500/10 text-xs"
          onClick={() => {
            session.clear();
            r.replace("/login");
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen md:flex bg-neutral-950 text-white">
      <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-black md:block md:sticky md:top-0 md:h-screen">
        {side}
      </aside>
      <header className="flex items-center justify-between border-b border-white/10 bg-black p-3 md:hidden">
        <div className="flex items-center gap-2">
          <Logo size={32} />
          <span className="font-semibold">ACM SIGGRAPH</span>
        </div>
        <div className="flex items-center gap-2">
          {!isStandalone && (
            <button
              onClick={handleInstallClick}
              className="rounded-md bg-orange-500/10 border border-orange-500/30 px-2.5 py-1 text-xs font-medium text-orange-400"
            >
              📲 Install App
            </button>
          )}
          <button
            className="btn-ghost"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            ☰
          </button>
        </div>
      </header>
      {open && <div className="fixed inset-0 z-40 bg-black md:hidden pt-14">{side}</div>}
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}

export const _t = today;
