import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeckViewerLoader } from "@/components/deck-viewer-loader";
import { readDeck } from "@/lib/decks";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const deck = await readDeck(id);
  if (!deck) return { title: "Presentation not found — Pitchpage" };
  return {
    title: `${deck.companyName} — Pitchpage`,
    description: `Explore the ${deck.companyName} pitch presentation.`,
    robots: { index: false, follow: false },
  };
}

export default async function DeckPage({ params }: PageProps) {
  const { id } = await params;
  const deck = await readDeck(id);
  if (!deck) notFound();

  return <DeckViewerLoader deck={deck} />;
}
