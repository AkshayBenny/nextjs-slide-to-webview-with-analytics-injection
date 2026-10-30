import type { Metadata } from "next";
import { AnalyticsConsent } from "@/components/analytics-consent";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pitchpage — Turn your pitch deck into a website",
  description: "Upload a pitch deck and turn it into a scrollable, shareable website with clickable slide links.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AnalyticsConsent />
      </body>
    </html>
  );
}
