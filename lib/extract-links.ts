import { spawn } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { DeckLinkOverlay } from "@/lib/types";

const EXTRACTION_TIMEOUT_MS = 20_000;

/**
 * Extract shape-level PPTX click actions. If Python is unavailable, the deck still
 * renders and PDF.js continues to handle any link annotations present in the PDF.
 */
export async function extractPptxLinks(sourcePath: string, outputDirectory: string): Promise<DeckLinkOverlay[]> {
  const scriptPath = path.join(process.cwd(), "scripts", "extract_pptx_links.py");
  const outputPath = path.join(outputDirectory, "links.json");
  const executable = process.env.PYTHON_PATH || "python3";

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, [scriptPath, sourcePath, outputPath], { stdio: "ignore" });
      let settled = false;

      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve();
      };

      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        finish(new Error("PowerPoint link extraction timed out."));
      }, EXTRACTION_TIMEOUT_MS);

      child.once("error", finish);
      child.once("close", (code) => {
        if (code === 0) finish();
        else finish(new Error("Could not extract PowerPoint shape actions."));
      });
    });

    const parsed = JSON.parse(await readFile(outputPath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((link): link is DeckLinkOverlay => {
      if (!link || typeof link !== "object") return false;
      const item = link as Record<string, unknown>;
      return (
        Number.isInteger(item.slideNumber) &&
        typeof item.left === "number" &&
        typeof item.top === "number" &&
        typeof item.width === "number" &&
        typeof item.height === "number" &&
        typeof item.href === "string" &&
        (item.kind === "external" || item.kind === "internal")
      );
    });
  } catch {
    return [];
  } finally {
    // Metadata contains the validated link data; the temporary JSON is not needed.
    await rm(outputPath, { force: true }).catch(() => undefined);
  }
}
