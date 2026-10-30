import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { deckPdfExists, getDeckDirectory, isValidDeckId } from "@/lib/decks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!isValidDeckId(id) || !(await deckPdfExists(id))) {
    return NextResponse.json({ error: "Presentation not found." }, { status: 404 });
  }

  const pdfPath = path.join(getDeckDirectory(id), "deck.pdf");
  const fileInfo = await stat(pdfPath);
  const stream = Readable.toWeb(createReadStream(pdfPath)) as ReadableStream<Uint8Array>;

  return new Response(stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(fileInfo.size),
      "Content-Disposition": "inline; filename=\"presentation.pdf\"",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
