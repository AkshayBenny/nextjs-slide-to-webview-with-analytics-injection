"use client";

import { useEffect, useState } from "react";
import {
  analyticsConfigured,
  captureEvent,
  initializeAnalytics,
  revokeAnalyticsConsent,
} from "@/lib/analytics";

const CONSENT_KEY = "pitch-to-web-analytics-consent";
type ConsentChoice = "accepted" | "rejected";

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!analyticsConfigured) return;

    const choice = window.localStorage.getItem(CONSENT_KEY) as ConsentChoice | null;
    if (choice === "accepted") {
      initializeAnalytics();
    } else if (choice !== "rejected") {
      setVisible(true);
    }
  }, []);

  function choose(choice: ConsentChoice) {
    window.localStorage.setItem(CONSENT_KEY, choice);
    setVisible(false);

    if (choice === "accepted") {
      initializeAnalytics();
      captureEvent("analytics_consent_updated", { consent: "granted" });
      window.dispatchEvent(new Event("pitchpage:analytics-consent-granted"));
    } else {
      revokeAnalyticsConsent();
    }
  }

  if (!analyticsConfigured) return null;

  return (
    <>
      {!visible && (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="fixed bottom-4 right-4 z-40 rounded-full border border-slate-200 bg-white/95 px-3 py-2 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur transition hover:text-slate-900"
        >
          Privacy settings
        </button>
      )}
      {visible && (
        <aside
          aria-label="Analytics preferences"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-4xl flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_20px_70px_rgba(15,23,42,0.18)] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="max-w-xl">
            <p className="text-sm font-semibold text-slate-900">Help us improve the deck experience</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              With your permission, we use PostHog to understand slide views, scrolling and link clicks. We do not track these events unless you opt in.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => choose("rejected")}
              className="rounded-full px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => choose("accepted")}
              className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
            >
              Allow analytics
            </button>
          </div>
        </aside>
      )}
    </>
  );
}
