"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

export default function ServiceWorkerRegistration() {
  const updatePromptShown = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Track if a SW update is waiting
    let waitingWorker: ServiceWorker | null = null;

    function showUpdateToast() {
      if (updatePromptShown.current) return;
      updatePromptShown.current = true;

      toast("Update Available", {
        description:
          "A new version of Sharda Masale is ready. Refresh to get the latest features.",
        duration: Infinity,
        action: {
          label: "Refresh",
          onClick: () => {
            if (waitingWorker) {
              waitingWorker.postMessage({ type: "SKIP_WAITING" });
            }
            window.location.reload();
          },
        },
      });
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("SW registered:", registration.scope);

        // If a waiting worker already exists, show the update prompt
        if (registration.waiting) {
          waitingWorker = registration.waiting;
          showUpdateToast();
        }

        // Listen for new SW being installed
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          waitingWorker = newWorker;

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast();
            }
          });
        });
      })
      .catch((error) => {
        console.error("SW registration failed:", error);
      });

    // Listen for controller change (e.g., after skipWaiting)
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  }, []);

  return null;
}
