# Pitchpage — pitch deck to website POC

A Next.js App Router + Tailwind CSS proof of concept. Upload a company name and a `.pptx` or `.pdf`; the app creates a shareable URL where every slide is shown as a full-width page in a vertical scroll. Exported PDF link annotations remain clickable, and PostHog events are captured for meaningful viewer interactions after analytics consent.

## How the conversion works

1. The upload API validates the filename, extension, file signature and 30 MB limit.
2. PDF uploads are copied directly. PPTX uploads are converted to PDF with LibreOffice Impress in headless mode using a per-upload LibreOffice profile.
3. For PPTX files, a small Python standard-library parser also reads shape-level click actions and their bounding boxes. This restores common button actions such as navigating to another slide, which LibreOffice may not export as PDF annotations.
4. The PDF is rendered in the browser with PDF.js via React-PDF. Slide pages are loaded lazily near the viewport to avoid rendering every canvas up front.
5. PDF annotation overlays and PPTX-derived HTML link overlays provide clickable links. The viewer records a click before the link follows its destination.

This is deliberately a PDF-backed POC. It preserves slide appearance much more reliably than manually recreating every PowerPoint shape in HTML, but it is **not** a full PowerPoint runtime.

## Run locally

Requirements:

- Node.js 22.13 or newer.
- LibreOffice Impress available on `PATH` for `.pptx` uploads. PDF uploads do not need LibreOffice.
- Python 3 for extraction of PPTX shape-level click actions. The extractor uses only the standard library. If Python is unavailable, PDF annotations still work but the extra PowerPoint button overlays are skipped.
- A PostHog project if you want analytics events to reach PostHog.

```bash
cp .env.example .env.local
# Add your PostHog project key to .env.local (optional for local UI testing)
npm install
npm run dev
```

Open <http://localhost:3000>.

For `.pptx` conversion and shape-action extraction on Ubuntu/Debian:

```bash
sudo apt-get update
sudo apt-get install -y libreoffice-impress python3 fonts-liberation fonts-crosextra-carlito
```

## Run with Docker

The Docker image includes LibreOffice Impress, Python 3 for PPTX action extraction, and fallback fonts used for conversion.

```bash
docker build \
  --build-arg NEXT_PUBLIC_POSTHOG_KEY=phc_your_project_key \
  --build-arg NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com \
  -t pitchpage .
docker run --rm -p 3000:3000 \
  -v pitchpage-data:/app/.data \
  pitchpage
```

`NEXT_PUBLIC_` values are embedded into the browser bundle at build time, so pass the PostHog values as Docker build arguments. Omit the arguments to run without PostHog analytics.

The named volume keeps generated deck PDFs available across container restarts. For deployments, mount persistent storage at `/app/.data` and set `DECK_STORAGE_DIR=/app/.data/decks`.

## PostHog events

Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in `.env.local` (EU default: `https://eu.i.posthog.com`; US projects: `https://us.i.posthog.com`). Visitors see a small consent banner. PostHog is initialized only after they opt in. Rejecting leaves tracking disabled. Autocapture and automatic pageviews are disabled so the event stream stays intentional.

| Event | When it fires | Main properties |
|---|---|---|
| `analytics_consent_updated` | Visitor opts in to analytics | `consent` |
| `deck_upload_started` | Visitor submits an upload | `company_name`, `source_format`, `file_size_bytes` |
| `deck_upload_completed` | Conversion succeeds | `deck_id`, `company_name`, `source_format` |
| `deck_upload_failed` | Upload or conversion fails | `company_name`, `error_message` |
| `deck_viewed` | PDF is opened in the viewer | `deck_id`, `company_name`, `slide_count` |
| `slide_viewed` | A slide first becomes the most visible slide in the viewport | `slide_number`, `slide_count` |
| `slide_entered` | The active slide changes as the visitor scrolls | `slide_number`, `previous_slide_number`, `scroll_percentage` |
| `deck_scroll_depth` | Visitor crosses 25%, 50%, 75%, 90% or 100% document depth | `scroll_depth_percent`, `active_slide_number` |
| `slide_link_clicked` | Visitor clicks a PDF link annotation or PowerPoint action overlay | `slide_number`, `link_url`, `link_text`, `link_target`, `link_type` |
| `deck_share_link_copied` | Visitor copies the share URL | `deck_id`, `company_name` |
| `deck_view_ended` | Browser fires `pagehide` | `duration_ms`, `max_scroll_depth_percent`, `slides_viewed` |

Scroll tracking is based on slide transitions and depth milestones rather than capturing every wheel/touchmove tick. That produces more useful analytics and avoids flooding PostHog with high-frequency events.

## What stays interactive — and what does not

**Supported in this POC:**

- External hyperlinks, email links and PDF annotations retained by the conversion.
- Common shape-level PowerPoint click actions: URL links and internal slide jumps (including first/last/next/previous slide actions).
- Text-run hyperlinks surfaced by PDF.js when the converter exports their precise link rectangles.
- Click tracking for native PDF annotations and PPTX-derived clickable shape overlays.

**Not guaranteed / not supported by the PDF-backed renderer:**

- PowerPoint animations, transitions, animation-triggered buttons and hover states.
- Embedded video/audio playback, live charts, 3D objects or embedded app content.
- PowerPoint macros, scripts, animation triggers, embedded media controls, custom form controls and arbitrary button logic outside the extracted URL/slide-jump actions.
- Exact font parity if the server does not have the presentation's fonts installed.

A shape that only looks like a button but has no hyperlink/action will remain visual, not interactive. Grouped-shape transforms and run-level link geometry are handled by the PDF converter where possible; the extra PPTX overlay parser intentionally targets direct, shape-level actions. Always test converted links with representative decks before sharing externally.

## POC constraints and production hardening

- Storage is a local filesystem folder (`.data/decks` by default). This is suitable for local development or a single server with a persistent disk, not stateless serverless deployment. Use S3/R2 plus a database for a multi-instance product.
- Share URLs are unlisted UUID URLs and are not listed on the homepage or in a public deck directory, but they are **not** access-controlled. Anyone with the link can view the deck. Add authentication, expiry and/or password protection before using confidential fundraising material.
- The converter runs LibreOffice and a small Python parser on the app server. For production, move conversion into an isolated worker/container with CPU, memory, time and filesystem limits, and disable outbound network access during conversion.
- Add malware scanning, rate limits, retention/deletion controls, access logging, and a privacy notice before public launch.
- For strict visual fidelity, install the pitch deck's fonts on the converter host.
- The client-side PostHog key is a public project key by design. Never put a PostHog personal API key or secret in a `NEXT_PUBLIC_` variable.

## Suggested next step for a higher-fidelity product

Keep the current PDF renderer as a reliable visual fallback, then expand the XML overlay parser to cover grouped-shape coordinate transforms, more PowerPoint action types and precise hit areas for rich text runs. Recreating animation triggers, macros and embedded media will require explicitly supported web runtime behavior rather than a simple file conversion.
