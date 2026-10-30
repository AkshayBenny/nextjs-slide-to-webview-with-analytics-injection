"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { captureEvent } from "@/lib/analytics";

type UploadResponse = { id?: string; url?: string; error?: string };
const MAX_BYTES = 30 * 1024 * 1024;

function validateFile(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "pptx" && extension !== "pdf") {
    return "Choose a PowerPoint (.pptx) or PDF presentation.";
  }
  if (file.size > MAX_BYTES) return "This file is larger than 30 MB. Choose a smaller presentation.";
  if (file.size === 0) return "That file is empty. Choose another presentation.";
  return null;
}

export function UploadForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [companyName, setCompanyName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCandidate(nextFile: File | undefined) {
    if (!nextFile) return;
    const validationError = validateFile(nextFile);
    setError(validationError);
    setFile(validationError ? null : nextFile);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    setCandidate(event.dataTransfer.files?.[0]);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedCompany = companyName.trim();
    if (!trimmedCompany) {
      setError("Enter the company name first.");
      return;
    }
    if (!file) {
      setError("Add a PPTX or PDF presentation to continue.");
      return;
    }

    setUploading(true);
    captureEvent("deck_upload_started", {
      company_name: trimmedCompany,
      source_format: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "pptx",
      file_size_bytes: file.size,
    });

    try {
      const formData = new FormData();
      formData.set("companyName", trimmedCompany);
      formData.set("file", file);

      const response = await fetch("/api/decks", { method: "POST", body: formData });
      const result = (await response.json()) as UploadResponse;

      if (!response.ok || !result.url) {
        throw new Error(result.error || "Upload failed. Please try again.");
      }

      captureEvent("deck_upload_completed", {
        deck_id: result.id,
        company_name: trimmedCompany,
        source_format: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : "pptx",
        file_size_bytes: file.size,
      });
      window.location.assign(result.url);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Something went wrong while uploading.";
      captureEvent("deck_upload_failed", { company_name: trimmedCompany, error_message: message });
      setError(message);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-[0_24px_80px_rgba(18,30,44,0.08)] sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950">Create your deck website</p>
          <p className="mt-1 text-xs text-slate-500">Two details. One shareable page.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">Free POC</span>
      </div>

      <label htmlFor="company-name" className="mb-2 block text-xs font-semibold text-slate-700">Company name</label>
      <input
        id="company-name"
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
        maxLength={120}
        placeholder="e.g. Northstar Labs"
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
      />

      <div className="mb-2 mt-5 flex items-center justify-between gap-3">
        <label htmlFor="pitch-file" className="block text-xs font-semibold text-slate-700">Pitch presentation</label>
        <span className="text-[11px] text-slate-400">PPTX or PDF · up to 30 MB</span>
      </div>
      <input
        ref={inputRef}
        id="pitch-file"
        type="file"
        accept=".pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        className="sr-only"
        onChange={(event) => setCandidate(event.target.files?.[0])}
      />
      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
        role="button"
        tabIndex={0}
        aria-label="Choose or drop a pitch presentation"
        className={`group flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-6 text-center transition ${dragging ? "border-indigo-400 bg-indigo-50" : "border-slate-300 bg-slate-50/80 hover:border-slate-400 hover:bg-slate-50"}`}
      >
        <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 transition group-hover:-translate-y-0.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
            <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16.5v2A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {file ? (
          <>
            <span className="max-w-full truncate text-sm font-semibold text-slate-800">{file.name}</span>
            <span className="mt-1 text-xs text-slate-400">{(file.size / (1024 * 1024)).toFixed(1)} MB · Click to replace</span>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-slate-700">Drop your presentation here</span>
            <span className="mt-1 text-xs text-slate-400">or <span className="font-semibold text-slate-700 underline underline-offset-2">browse files</span></span>
          </>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{error}</p>}

      <button
        type="submit"
        disabled={uploading}
        className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {uploading ? (
          <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Converting your presentation…</>
        ) : (
          <>Turn into a website <span aria-hidden="true">↗</span></>
        )}
      </button>
      <p className="mt-3 text-center text-[11px] leading-5 text-slate-400">A rendered copy is stored on this demo server so the generated link can be revisited.</p>
    </form>
  );
}
