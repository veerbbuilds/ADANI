"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Download, Share, PlusSquare, Smartphone, Check } from "lucide-react";

export default function PwaInstallPrompt() {
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "desktop" | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [installStep, setInstallStep] = useState<number>(1);
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // 🔒 Security Polyfill: Intercept global window.fetch to enforce a default 15-second timeout (CWE-400)
    if (!(window as any).__fetch_intercepted__) {
      (window as any).__fetch_intercepted__ = true;
      const originalFetch = window.fetch;
      window.fetch = async function (input, init) {
        if (init?.signal) {
          return originalFetch(input, init);
        }
        const timeout = (init as any)?.timeout ?? 15000;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await originalFetch(input, {
            ...init,
            signal: controller.signal,
          });
          clearTimeout(id);
          return response;
        } catch (error: any) {
          clearTimeout(id);
          if (error.name === "AbortError") {
            throw new Error(`Request timed out after ${timeout}ms.`);
          }
          throw error;
        }
      };
    }

    // 1. Detect if app is already running in standalone mode (installed)
    const checkIsInstalled = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isIOSStandalone = (window.navigator as any).standalone === true;
      return isStandalone || isIOSStandalone;
    };

    if (checkIsInstalled()) {
      setIsInstalled(true);
      return;
    }

    // 2. Check if user dismissed the prompt recently
    const dismissedUntil = localStorage.getItem("pwa_prompt_dismissed_until");
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // 3. Detect Platform
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent) || 
                  (/macintosh/.test(userAgent) && "ontouchend" in document);
    const isAndroid = /android/.test(userAgent);

    if (isIOS) {
      setPlatform("ios");
      // Delayed trigger to let the page load completely first
      const timer = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(timer);
    } else if (isAndroid) {
      setPlatform("android");
    } else {
      setPlatform("desktop");
    }

    // 4. Capture native beforeinstallprompt event for Android / Chrome
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallAndroid = async () => {
    const promptEvent = deferredPromptRef.current;
    if (!promptEvent) return;

    // Show native install dialog
    promptEvent.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsVisible(false);
    }
    deferredPromptRef.current = null;
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Dismiss prompt for 7 days
    const snoozeDuration = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      "pwa_prompt_dismissed_until",
      (Date.now() + snoozeDuration).toString()
    );
  };

  if (!isVisible || isInstalled) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:max-w-md z-50 animate-fadeIn">
      <div className="card-panel p-5 bg-white/95 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl relative overflow-hidden">
        
        {/* Decorative Top Accent line (Corporate Indigo) */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-blue"></div>

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 p-1 rounded-lg transition-colors cursor-pointer"
          aria-label="Dismiss guide"
        >
          <X size={15} />
        </button>

        {platform === "ios" ? (
          /* iOS Safari Step-by-Step Installation Prompt */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue/10 rounded-xl text-blue">
                <Smartphone size={20} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Install Logistics App
                </h4>
                <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">
                  Safari iOS Installation Guide
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              Add the logistics logbook app directly to your iPhone / iPad Home Screen for offline access and native app controls.
            </p>

            <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-blue text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5 flex-wrap">
                  Tap the **Share** button in Safari footer: 
                  <span className="inline-flex items-center justify-center p-1 bg-white border border-slate-200 rounded text-slate-500 shadow-sm shrink-0">
                    <Share size={12} />
                  </span>
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-blue text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-xs text-slate-700 font-semibold flex items-center gap-1.5 flex-wrap">
                  Scroll down and tap **Add to Home Screen**: 
                  <span className="inline-flex items-center justify-center p-1 bg-white border border-slate-200 rounded text-slate-500 shadow-sm shrink-0">
                    <PlusSquare size={12} />
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wide">
                MAS Marine Services
              </span>
              <button
                onClick={handleDismiss}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        ) : (
          /* Android / Chrome Native Install Banner */
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue/10 rounded-xl text-blue">
                <Download size={20} className="pulse-icon" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">
                  Install Logistics App
                </h4>
                <p className="text-[10px] text-slate-405 font-bold uppercase tracking-wider">
                  Android & Desktop PWA
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
              Launch Port Logistics directly from your Home Screen or Dock. Fully offline capable with secure encryption logs cached locally.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={handleDismiss}
                className="px-4 py-2 border border-slate-200 text-slate-550 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={handleInstallAndroid}
                className="px-5 py-2 bg-blue hover:bg-sky-750 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-blue/20 cursor-pointer"
              >
                <Download size={13} />
                <span>Install Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
