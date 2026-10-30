import posthog from "posthog-js";

type EventProperties = Record<string, string | number | boolean | null | undefined>;

let isInitialized = false;

export const analyticsConfigured = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY);

export function initializeAnalytics(): void {
  if (typeof window === "undefined" || !analyticsConfigured) return;

  if (!isInitialized) {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY as string, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      person_profiles: "identified_only",
    });
    isInitialized = true;
  }

  posthog.opt_in_capturing();
}

export function revokeAnalyticsConsent(): void {
  if (isInitialized) posthog.opt_out_capturing();
}

export function captureEvent(eventName: string, properties: EventProperties = {}): void {
  if (!isInitialized) return;
  posthog.capture(eventName, properties);
}
