"use client";

import dynamic from "next/dynamic";
import type { DeckMetadata } from "@/lib/types";

const DeckViewer = dynamic(
  () => import("@/components/deck-viewer").then((module) => module.DeckViewer),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-[#f1f2f4] px-5 text-sm text-slate-500">
        Opening presentation…
      </main>
    ),
  },
);

export function DeckViewerLoader({ deck }: { deck: DeckMetadata }) {
  return <DeckViewer deck={deck} />;
}
