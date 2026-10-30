import { NextResponse } from "next/server";
import { mkdir, open, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { convertPptxToPdf } from "@/lib/convert";
import { extractPptxLinks } from "@/lib/extract-links";
import { createDeckId, getDeckDirectory, getStorageRoot } from "@/lib/decks";
import type { DeckLinkOverlay, DeckMetadata, SourceFormat } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 30 * 1024 * 1024;
const MAX_COMPANY_NAME_LENGTH = 120;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let deckDirectory: string | null = null;

  try {
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (declaredLength > MAX_FILE_BYTES + 1024 * 1024) {
      return jsonError("The maximum request size is 31 MB.", 413);
    }

    const formData = await request.formData();
    const rawCompanyName = formData.get("companyName");
    const uploadedFile = formData.get("file");

    if (typeof rawCompanyName !== "string") {
      return jsonError("Company name is required.", 400);
    }
    const companyName = rawCompanyName.trim().slice(0, MAX_COMPANY_NAME_LENGTH);
    if (!companyName) return jsonError("Company name is required.", 400);

    if (!(uploadedFile instanceof File)) {
      return jsonError("Upload a PPTX or PDF presentation.", 400);
    }
    if (uploadedFile.size === 0) return jsonError("The uploaded file is empty.", 400);
    if (uploadedFile.size > MAX_FILE_BYTES) return jsonError("The maximum file size is 30 MB.", 413);

    const originalFileName = path.basename(uploadedFile.name).replace(/[\u0000-\u001f]/g, "").slice(0, 180);
    const extension = path.extname(originalFileName).toLowerCase();
    if (extension !== ".pptx" && extension !== ".pdf") {
      return jsonError("Only PowerPoint (.pptx) and PDF files are supported.", 415);
    }

    const fileBuffer = Buffer.from(await uploadedFile.arrayBuffer());
    const isPdf = extension === ".pdf";
    const signatureIsValid = isPdf
      ? fileBuffer.subarray(0, 5).toString("ascii") === "%PDF-"
      : fileBuffer.subarray(0, 2).toString("ascii") === "PK";

    if (!signatureIsValid) {
      return jsonError("The file contents do not match the selected presentation format.", 415);
    }

    const id = createDeckId();
    deckDirectory = getDeckDirectory(id);
    await mkdir(deckDirectory, { recursive: true });
    await mkdir(getStorageRoot(), { recursive: true });

    const sourcePath = path.join(deckDirectory, `source${extension}`);
    const sourceFormat: SourceFormat = isPdf ? "pdf" : "pptx";
    let links: DeckLinkOverlay[] = [];
    if (isPdf) {
      await writeFile(path.join(deckDirectory, "deck.pdf"), fileBuffer, { flag: "wx" });
    } else {
      await writeFile(sourcePath, fileBuffer, { flag: "wx" });
      await convertPptxToPdf(sourcePath, deckDirectory);
      links = await extractPptxLinks(sourcePath, deckDirectory);
      await rm(sourcePath, { force: true });
    }

    // A header and size check prevents storing a malformed or unexpectedly large conversion.
    const pdfPath = path.join(deckDirectory, "deck.pdf");
    const pdfStats = await stat(pdfPath);
    if (!pdfStats.isFile() || pdfStats.size < 5 || pdfStats.size > 100 * 1024 * 1024) {
      throw new Error("The converted PDF is empty or larger than the 100 MB output limit.");
    }
    const pdfHandle = await open(pdfPath, "r");
    const pdfHeader = Buffer.alloc(5);
    try {
      await pdfHandle.read(pdfHeader, 0, 5, 0);
    } finally {
      await pdfHandle.close();
    }
    if (pdfHeader.toString("ascii") !== "%PDF-") {
      throw new Error("The converted file is not a valid PDF.");
    }

    const metadata: DeckMetadata = {
      id,
      companyName,
      originalFileName,
      sourceFormat,
      createdAt: new Date().toISOString(),
      sizeBytes: uploadedFile.size,
      links,
    };

    const temporaryMetadataPath = path.join(deckDirectory, "metadata.tmp");
    await writeFile(temporaryMetadataPath, JSON.stringify(metadata, null, 2), { flag: "wx" });
    await rename(temporaryMetadataPath, path.join(deckDirectory, "metadata.json"));

    return NextResponse.json({ id, url: `/d/${id}`, deck: metadata }, { status: 201 });
  } catch (error) {
    if (deckDirectory) await rm(deckDirectory, { recursive: true, force: true }).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unable to process this presentation.";
    return jsonError(message, 500);
  }
}
