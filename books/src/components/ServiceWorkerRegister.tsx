"use client";

import { useEffect } from "react";

/** Registers the offline service worker so the app opens even with no signal. */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not fatal. The app still works online without the service worker.
      });
    }
  }, []);
  return null;
}
