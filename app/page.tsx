import { UploadForm } from "@/components/upload-form";

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f6f2] text-slate-950">
      <header className="relative z-10 mx-auto flex h-[76px] max-w-[1320px] items-center justify-between px-5 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="Pitchpage home">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black tracking-tight text-white">P.</span>
          <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-800">Pitchpage</span>
        </a>
        <div className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Presentation to webpage
        </div>
      </header>

      <section className="relative mx-auto grid max-w-[1320px] items-center gap-12 px-5 pb-20 pt-9 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:pb-28 lg:pt-16">
        <div className="pointer-events-none absolute -left-48 top-12 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.10),transparent_68%)]" />
        <div className="relative z-10 max-w-[620px]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            A better way to share your pitch
          </div>
          <h1 className="max-w-[650px] text-[clamp(2.8rem,6vw,5.6rem)] font-semibold leading-[0.99] tracking-[-0.065em] text-slate-950">
            Your pitch deck.
            <span className="block text-indigo-600">A website now.</span>
          </h1>
          <p className="mt-7 max-w-[510px] text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Turn your presentation into a clean, scrollable page. Keep the look of every slide, make links clickable, and see how people engage with your story.
          </p>

          <div className="mt-10 grid max-w-[530px] grid-cols-3 gap-4 border-t border-slate-200 pt-6">
            <div>
              <p className="text-xl font-semibold tracking-tight text-slate-950">01</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">Upload your deck</p>
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight text-slate-950">02</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">Convert every slide</p>
            </div>
            <div>
              <p className="text-xl font-semibold tracking-tight text-slate-950">03</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">Share one link</p>
            </div>
          </div>

          <div className="mt-12 hidden items-center gap-4 lg:flex">
            <div className="flex -space-x-2">
              <span className="h-8 w-8 rounded-full border-2 border-[#f6f6f2] bg-[#d9d5ff]" />
              <span className="h-8 w-8 rounded-full border-2 border-[#f6f6f2] bg-[#cfe8df]" />
              <span className="h-8 w-8 rounded-full border-2 border-[#f6f6f2] bg-[#f4d7c7]" />
            </div>
            <p className="text-xs text-slate-500">Built for founders, fundraisers and teams.</p>
          </div>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[530px] lg:ml-auto">
          <div className="absolute -right-5 -top-5 h-28 w-28 rounded-full border border-indigo-200/70" />
          <div className="absolute -bottom-7 -left-7 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.13),transparent_70%)]" />
          <div className="relative">
            <UploadForm />
          </div>
          <div className="relative mt-5 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true"><path d="M8 1.5 13 3.5v3.8c0 3.1-2.1 5.6-5 7.2-2.9-1.6-5-4.1-5-7.2V3.5L8 1.5Z"/><path d="m5.8 7.8 1.5 1.5 3-3.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Files stay on this demo server. Share links are unlisted, not password-protected.
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white/70">
        <div className="mx-auto grid max-w-[1320px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-3 md:gap-10 md:py-14">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">01 / Faithful</p>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">Keep your slide design</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Each page is rendered from the converted presentation, so layouts, typography and imagery stay together.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">02 / Interactive</p>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">Keep useful clicks</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Links and internal slide navigation exported into the PDF remain interactive in the web viewer.</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">03 / Measurable</p>
            <h2 className="mt-3 text-lg font-semibold tracking-tight">Understand engagement</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">With visitor consent, PostHog records slide views, slide transitions, scroll depth and link clicks.</p>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1320px] flex-col items-center justify-between gap-3 border-t border-slate-200 px-5 py-7 text-[11px] text-slate-400 sm:flex-row sm:px-8">
        <span>© 2026 Pitchpage · Proof of concept</span>
        <span>Make every slide count.</span>
      </footer>
    </main>
  );
}
