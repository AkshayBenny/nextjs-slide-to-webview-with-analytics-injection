'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import type { MouseEvent } from 'react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { captureEvent } from '@/lib/analytics'
import type { DeckMetadata } from '@/lib/types'

// Keep this worker configuration in the same client module as Document and Page.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	'pdfjs-dist/build/pdf.worker.min.mjs',
	import.meta.url,
).toString()

type DeckViewerProps = { deck: DeckMetadata }
const SCROLL_THRESHOLDS = [25, 50, 75, 90, 100]

function LazySlidePage({
	slideNumber,
	width,
	aspectRatio,
	links,
}: {
	slideNumber: number
	width: number
	aspectRatio: number
	links: DeckMetadata['links']
}) {
	const placeholderRef = useRef<HTMLDivElement>(null)
	const [nearViewport, setNearViewport] = useState(false)

	useEffect(() => {
		const element = placeholderRef.current
		if (!element) return
		const observer = new IntersectionObserver(
			([entry]) => {
				setNearViewport(entry.isIntersecting)
			},
			{ rootMargin: '1200px 0px' },
		)
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	return (
		<div className='relative overflow-hidden rounded-[4px] bg-white shadow-[0_8px_35px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04]'>
			<div ref={placeholderRef}>
				{nearViewport ? (
					<Page
						pageNumber={slideNumber}
						width={width}
						renderTextLayer={false}
						renderAnnotationLayer={true}
						loading={
							<div
								style={{ aspectRatio }}
								className='w-full animate-pulse bg-slate-100'
							/>
						}
					/>
				) : (
					<div
						style={{ aspectRatio }}
						className='w-full bg-white'
						aria-hidden='true'
					/>
				)}
			</div>
			{nearViewport &&
				links.map((link, index) => (
					<a
						key={`${slideNumber}-shape-link-${index}`}
						href={link.href}
						target={link.newTab ? '_blank' : undefined}
						rel={link.newTab ? 'noopener noreferrer' : undefined}
						aria-label={`Slide ${slideNumber}: ${link.label}`}
						title={link.label}
						className='pptx-link-overlay'
						style={{
							left: `${link.left}%`,
							top: `${link.top}%`,
							width: `${link.width}%`,
							height: `${link.height}%`,
						}}
					/>
				))}
		</div>
	)
}

export function DeckViewer({ deck }: DeckViewerProps) {
	const documentRef = useRef<HTMLDivElement>(null)
	const intersectionRatios = useRef(new Map<Element, number>())
	const activeSlideRef = useRef<number | null>(null)
	const seenSlidesRef = useRef(new Set<number>())
	const scrollThresholdsRef = useRef(new Set<number>())
	const sessionStartedAt = useRef(Date.now())
	const maxScrollDepthRef = useRef(0)
	const [pageWidth, setPageWidth] = useState(1200)
	const [numPages, setNumPages] = useState(0)
	const [pageRatios, setPageRatios] = useState<Record<number, number>>({})
	const [loadError, setLoadError] = useState<string | null>(null)
	const [copied, setCopied] = useState(false)

	const pdfUrl = useMemo(() => `/api/decks/${deck.id}/file`, [deck.id])

	useEffect(() => {
		const element = documentRef.current
		if (!element) return

		const resizeObserver = new ResizeObserver((entries) => {
			const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 1200)
			if (nextWidth > 0) setPageWidth(Math.min(nextWidth, 1440))
		})
		resizeObserver.observe(element)
		return () => resizeObserver.disconnect()
	}, [])

	const onDocumentLoad = useCallback(
		async (pdf: {
			numPages: number
			getPage: (
				pageNumber: number,
			) => Promise<{
				getViewport: (options: { scale: number }) => {
					width: number
					height: number
				}
			}>
		}) => {
			setNumPages(pdf.numPages)
			setLoadError(null)
			captureEvent('deck_viewed', {
				deck_id: deck.id,
				company_name: deck.companyName,
				slide_count: pdf.numPages,
				source_format: deck.sourceFormat,
			})

			// Read page dimensions without painting canvases so unloaded slides can reserve their true aspect ratio.
			try {
				const dimensions = await Promise.all(
					Array.from({ length: pdf.numPages }, async (_, index) => {
						const page = await pdf.getPage(index + 1)
						const viewport = page.getViewport({ scale: 1 })
						return [
							index + 1,
							viewport.width / viewport.height,
						] as const
					}),
				)
				setPageRatios(Object.fromEntries(dimensions))
			} catch {
				// The viewer keeps its 16:9 placeholder ratio if a page size cannot be read.
			}
		},
		[deck.companyName, deck.id, deck.sourceFormat],
	)

	useEffect(() => {
		const root = documentRef.current
		if (!root || numPages === 0) return

		intersectionRatios.current.clear()
		activeSlideRef.current = null
		seenSlidesRef.current.clear()

		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					intersectionRatios.current.set(
						entry.target,
						entry.isIntersecting ? entry.intersectionRatio : 0,
					)
				}

				const mostVisible = [...intersectionRatios.current.entries()]
					.filter(([, ratio]) => ratio >= 0.3)
					.sort((a, b) => b[1] - a[1])[0]

				if (!mostVisible) return
				const slideNumber = Number(
					(mostVisible[0] as HTMLElement).dataset.slideNumber,
				)
				if (
					!Number.isFinite(slideNumber) ||
					activeSlideRef.current === slideNumber
				)
					return

				const previousSlide = activeSlideRef.current
				activeSlideRef.current = slideNumber
				const scrollableHeight = Math.max(
					1,
					document.documentElement.scrollHeight - window.innerHeight,
				)
				const scrollPercentage = Math.round(
					(window.scrollY / scrollableHeight) * 100,
				)

				captureEvent('slide_entered', {
					deck_id: deck.id,
					company_name: deck.companyName,
					slide_number: slideNumber,
					previous_slide_number: previousSlide,
					scroll_percentage: Math.min(
						100,
						Math.max(0, scrollPercentage),
					),
				})

				if (!seenSlidesRef.current.has(slideNumber)) {
					seenSlidesRef.current.add(slideNumber)
					captureEvent('slide_viewed', {
						deck_id: deck.id,
						company_name: deck.companyName,
						slide_number: slideNumber,
						slide_count: numPages,
					})
				}
			},
			{ threshold: [0, 0.15, 0.3, 0.5, 0.75, 1] },
		)

		const slides = root.querySelectorAll<HTMLElement>('[data-slide-number]')
		slides.forEach((slide) => observer.observe(slide))

		return () => observer.disconnect()
	}, [deck.companyName, deck.id, numPages])

	useEffect(() => {
		const onScroll = () => {
			const scrollableHeight =
				document.documentElement.scrollHeight - window.innerHeight
			const percentage =
				scrollableHeight <= 0
					? 100
					: Math.min(
							100,
							Math.max(
								0,
								(window.scrollY / scrollableHeight) * 100,
							),
						)
			maxScrollDepthRef.current = Math.max(
				maxScrollDepthRef.current,
				percentage,
			)

			for (const threshold of SCROLL_THRESHOLDS) {
				if (
					percentage >= threshold &&
					!scrollThresholdsRef.current.has(threshold)
				) {
					scrollThresholdsRef.current.add(threshold)
					captureEvent('deck_scroll_depth', {
						deck_id: deck.id,
						company_name: deck.companyName,
						scroll_depth_percent: threshold,
						active_slide_number: activeSlideRef.current,
					})
				}
			}
		}

		window.addEventListener('scroll', onScroll, { passive: true })
		onScroll()

		return () => window.removeEventListener('scroll', onScroll)
	}, [deck.companyName, deck.id, numPages])

	useEffect(() => {
		const onAnalyticsConsentGranted = () => {
			// If the visitor accepts after the PDF has loaded, start measuring from that point.
			if (numPages === 0) return
			captureEvent('deck_viewed', {
				deck_id: deck.id,
				company_name: deck.companyName,
				slide_count: numPages,
				source_format: deck.sourceFormat,
				analytics_started_after_consent: true,
			})
			if (activeSlideRef.current !== null) {
				captureEvent('slide_viewed', {
					deck_id: deck.id,
					company_name: deck.companyName,
					slide_number: activeSlideRef.current,
					slide_count: numPages,
					analytics_started_after_consent: true,
				})
			}
		}

		window.addEventListener(
			'pitchpage:analytics-consent-granted',
			onAnalyticsConsentGranted,
		)
		return () =>
			window.removeEventListener(
				'pitchpage:analytics-consent-granted',
				onAnalyticsConsentGranted,
			)
	}, [deck.companyName, deck.id, deck.sourceFormat, numPages])

	useEffect(() => {
		const onPageHide = () => {
			captureEvent('deck_view_ended', {
				deck_id: deck.id,
				company_name: deck.companyName,
				duration_ms: Date.now() - sessionStartedAt.current,
				max_scroll_depth_percent: Math.round(maxScrollDepthRef.current),
				slides_viewed: seenSlidesRef.current.size,
			})
		}

		window.addEventListener('pagehide', onPageHide)
		return () => window.removeEventListener('pagehide', onPageHide)
	}, [deck.companyName, deck.id])

	function onSlideClick(event: MouseEvent<HTMLElement>, slideNumber: number) {
		const target = event.target as HTMLElement
		const link = target.closest('a')
		if (!link) return

		const href = link.getAttribute('href') || link.href || ''
		captureEvent('slide_link_clicked', {
			deck_id: deck.id,
			company_name: deck.companyName,
			slide_number: slideNumber,
			link_url: href,
			link_text: (
				link.textContent ||
				link.getAttribute('aria-label') ||
				link.getAttribute('title') ||
				''
			)
				.trim()
				.slice(0, 160),
			link_target: link.target || '_self',
			link_type: href.startsWith('#') ? 'internal' : 'external_or_action',
		})
	}

	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(window.location.href)
			setCopied(true)
			captureEvent('deck_share_link_copied', {
				deck_id: deck.id,
				company_name: deck.companyName,
			})
			window.setTimeout(() => setCopied(false), 1800)
		} catch {
			setCopied(false)
		}
	}

	return (
		<main className='min-h-screen bg-[#f1f2f4] text-slate-950'>
			<header className='sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl'>
				<div className='mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-4 px-4 sm:px-7'>
					<a
						href='/'
						className='flex min-w-0 items-center gap-3'
						aria-label='Back to Pitchpage home'>
						<span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-black tracking-tight text-white'>
							P.
						</span>
						<span className='hidden text-xs font-bold uppercase tracking-[0.18em] text-slate-500 sm:inline'>
							Pitchpage
						</span>
						<span className='hidden h-5 w-px bg-slate-200 sm:block' />
						<span className='truncate text-sm font-semibold text-slate-900'>
							{deck.companyName}
						</span>
					</a>
					<div className='flex shrink-0 items-center gap-2 sm:gap-3'>
						{numPages > 0 && (
							<span className='hidden text-xs tabular-nums text-slate-500 sm:inline'>
								{numPages} slides
							</span>
						)}
						<button
							type='button'
							onClick={copyShareLink}
							className='rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50'>
							{copied ? 'Copied link ✓' : 'Copy share link ↗'}
						</button>
					</div>
				</div>
			</header>

			<div className='border-b border-slate-200 bg-white px-4 py-3 sm:px-7'>
				<div className='mx-auto flex max-w-[1440px] items-center justify-between gap-3'>
					<p className='text-xs text-slate-500'>
						Scroll to explore{' '}
						<span className='mx-1 text-slate-300'>·</span> Links
						inside the slides remain clickable
					</p>
					{numPages > 0 && (
						<p className='text-[11px] font-medium tabular-nums text-slate-400'>
							01 — {String(numPages).padStart(2, '0')}
						</p>
					)}
				</div>
			</div>

			<div
				ref={documentRef}
				className='mx-auto w-full max-w-[1440px] px-3 pb-20 pt-5 sm:px-7 sm:pt-8'>
				{loadError ? (
					<div
						role='alert'
						className='rounded-2xl border border-rose-200 bg-white p-8 text-center'>
						<p className='font-semibold text-slate-900'>
							We couldn’t render this presentation
						</p>
						<p className='mt-2 text-sm text-slate-500'>
							{loadError}
						</p>
					</div>
				) : (
					<Document
						file={pdfUrl}
						suspense={false}
						onLoadSuccess={onDocumentLoad}
						onLoadError={(error) =>
							setLoadError(
								error.message || 'The PDF could not be opened.',
							)
						}
						loading={
							<div className='rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500'>
								Preparing your slides…
							</div>
						}
						error={
							<div className='rounded-2xl border border-rose-200 bg-white p-12 text-center text-sm text-rose-600'>
								Unable to load this presentation.
							</div>
						}>
						{Array.from({ length: numPages }, (_, index) => {
							const slideNumber = index + 1
							return (
								<section
									key={`slide-${slideNumber}`}
									id={`slide-${slideNumber}`}
									data-slide-number={slideNumber}
									aria-label={`Slide ${slideNumber}`}
									onClickCapture={(event) =>
										onSlideClick(event, slideNumber)
									}
									className='deck-slide mb-7 sm:mb-10'>
									<LazySlidePage
										slideNumber={slideNumber}
										width={pageWidth}
										aspectRatio={
											pageRatios[slideNumber] || 16 / 9
										}
										links={(deck.links ?? []).filter(
											(link) =>
												link.slideNumber ===
												slideNumber,
										)}
									/>
									<div className='flex items-center justify-between px-1 pt-2.5'>
										<span className='text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400'>
											{deck.companyName}
										</span>
										<span className='text-[10px] tabular-nums text-slate-400'>
											{String(slideNumber).padStart(
												2,
												'0',
											)}{' '}
											/{' '}
											{String(numPages).padStart(2, '0')}
										</span>
									</div>
								</section>
							)
						})}
					</Document>
				)}
			</div>

			<footer className='border-t border-slate-200 bg-white px-4 py-7 text-center'>
				<p className='text-[11px] text-slate-400'>
					Made with{' '}
					<span className='font-semibold text-slate-600'>
						Pitchpage
					</span>
				</p>
			</footer>
		</main>
	)
}
