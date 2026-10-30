import { spawn } from "node:child_process";
import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CONVERSION_TIMEOUT_MS = 90_000;

/** Convert a PPTX into a PDF using an isolated LibreOffice user profile. */
export async function convertPptxToPdf(sourcePath: string, outputDirectory: string): Promise<string> {
  await mkdir(outputDirectory, { recursive: true });

  const sourceName = path.basename(sourcePath, path.extname(sourcePath));
  const generatedPdf = path.join(outputDirectory, `${sourceName}.pdf`);
  const finalPdf = path.join(outputDirectory, "deck.pdf");
  const profileDirectory = path.join(outputDirectory, "lo-profile");
  await mkdir(profileDirectory, { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const executable = process.env.LIBREOFFICE_PATH || "libreoffice";
      const args = [
        `-env:UserInstallation=${pathToFileURL(profileDirectory).href}`,
        "--headless",
        "--convert-to",
        "pdf:impress_pdf_Export",
        "--outdir",
        outputDirectory,
        sourcePath,
      ];

      const child = spawn(executable, args, { stdio: "ignore" });
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
        finish(new Error("Presentation conversion timed out. Try a smaller or simpler file."));
      }, CONVERSION_TIMEOUT_MS);

      child.once("error", (error) => {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          finish(new Error("LibreOffice was not found. Install LibreOffice Impress or use the Docker setup."));
        } else {
          finish(error);
        }
      });

      child.once("close", (code) => {
        if (code !== 0) {
          finish(new Error("LibreOffice could not convert this presentation. Check that the file is a valid PPTX."));
        } else {
          finish();
        }
      });
    });

    try {
      await access(generatedPdf);
    } catch {
      throw new Error("The converter did not produce a PDF for this presentation.");
    }

    await rename(generatedPdf, finalPdf);
    return finalPdf;
  } finally {
    await rm(profileDirectory, { recursive: true, force: true }).catch(() => undefined);
  }
}
