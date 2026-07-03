"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export default function PwaRegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => setIsRegistered(true))
        .catch(() => setIsRegistered(false));
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const requestInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  if (!installPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/10 dark:border-slate-700 dark:bg-slate-950 dark:shadow-slate-950/20">
      <p className="text-sm text-slate-800 dark:text-slate-200">
        Install Audio Workout for offline access and quick launch.
      </p>
      <button
        className="mt-3 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        onClick={requestInstall}
      >
        Install App
      </button>
      {isRegistered ? (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Service worker registered.</p>
      ) : (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Registering PWA support...</p>
      )}
    </div>
  );
}
