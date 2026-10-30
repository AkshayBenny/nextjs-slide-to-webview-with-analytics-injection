import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { DeckMetadata } from "@/lib/types";

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createDeckId(): string {
  return randomUUID();
}

export function isValidDeckId(id: string): boolean {
  return ID_PATTERN.test(id);
}

export function getStorageRoot(): string {
  const configured = process.env.DECK_STORAGE_DIR || "./.data/decks";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

export function getDeckDirectory(id: string): string {
  if (!isValidDeckId(id)) throw new Error("Invalid deck id");
  return path.join(getStorageRoot(), id);
}

export async function readDeck(id: string): Promise<DeckMetadata | null> {
  if (!isValidDeckId(id)) return null;

  try {
    const raw = await readFile(path.join(getDeckDirectory(id), "metadata.json"), "utf8");
    const metadata = JSON.parse(raw) as DeckMetadata;
    if (metadata.id !== id || !metadata.companyName) return null;
    return metadata;
  } catch {
    return null;
  }
}

export async function deckPdfExists(id: string): Promise<boolean> {
  try {
    const pdfPath = path.join(getDeckDirectory(id), "deck.pdf");
    const details = await stat(pdfPath);
    return details.isFile() && details.size > 0;
  } catch {
    return false;
  }
}
