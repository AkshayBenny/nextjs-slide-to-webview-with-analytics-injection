'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import posthog from 'posthog-js'

interface SlideLink {
	id: string
	label: string
	url: string
	top: string
	left: string
	width: string
	height: string
}

interface SlideMeta {
	id: string
	number: number
	imageUrl: string
	links?: SlideLink[]
}

interface PresentationMeta {
	companyName: string
	companySlug: string
	slides: SlideMeta[]
}

export default function PitchViewerPage() {
	const params = useParams()
	const companySlug = params?.company as string

	const [meta, setMeta] = useState<PresentationMeta | null>(null)
	const [loading, setLoading] = useState(true)
	const [activeSlide, setActiveSlide] = useState<number>(1)
	const slideStartTime = useRef<{ [key: string]: number }>({})

	useEffect(() => {
		// Initialize PostHog targeting custom proxy endpoint
		if (typeof window !== 'undefined' && !posthog.__loaded) {
			posthog.init(
				process.env.NEXT_PUBLIC_POSTHOG_KEY || 'phc_placeholder',
				{
					api_host: '/ingest',
					ui_host: 'https://us.posthog.com',
					capture_pageview: false,
				},
			)
		}

		// Load presentation metadata generated from PPTX upload
		fetch(`/uploads/${companySlug}/metadata.json`)
			.then((res) => {
				if (!res.ok) throw new Error('Presentation not found')
				return res.json()
			})
			.then((data: PresentationMeta) => {
				setMeta(data)
				setLoading(false)

				posthog.identify(`prospect_${companySlug}`, {
					target_company: data.companyName,
				})
				posthog.capture('pitch_deck_opened', {
					recipient_company: data.companyName,
					total_slides: data.slides.length,
				})
			})
			.catch((err) => {
				console.error(err)
				setLoading(false)
			})
	}, [companySlug])

	// Track slide dwell time using IntersectionObserver
	useEffect(() => {
		if (!meta || !meta.slides) return

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const slideId = entry.target.getAttribute('data-slide-id')
					const slideNum = Number(
						entry.target.getAttribute('data-slide-number'),
					)
					if (!slideId) return

					if (entry.isIntersecting) {
						setActiveSlide(slideNum)
						slideStartTime.current[slideId] = Date.now()

						posthog.capture('slide_viewed', {
							slide_id: slideId,
							slide_number: slideNum,
							recipient_company: meta.companyName,
						})
					} else if (slideStartTime.current[slideId]) {
						const durationSeconds = Math.round(
							(Date.now() - slideStartTime.current[slideId]) /
								1000,
						)
						if (durationSeconds > 0) {
							posthog.capture('slide_time_spent', {
								slide_id: slideId,
								slide_number: slideNum,
								duration_seconds: durationSeconds,
								recipient_company: meta.companyName,
							})
						}
						delete slideStartTime.current[slideId]
					}
				})
			},
			{ threshold: 0.6 },
		)

		document
			.querySelectorAll('.slide-card')
			.forEach((el) => observer.observe(el))

		return () => observer.disconnect()
	}, [meta])

	const handleLinkClick = (slideNum: number, link: SlideLink) => {
		posthog.capture('pitch_link_clicked', {
			slide_number: slideNum,
			link_id: link.id,
			destination_url: link.url,
			recipient_company: meta?.companyName,
		})

		window.open(link.url, '_blank')
	}

	const handleCtaClick = () => {
		posthog.capture('pitch_cta_clicked', {
			action: 'Schedule Call',
			recipient_company: meta?.companyName,
		})
		alert(`Meeting request submitted for ${meta?.companyName}.`)
	}

	if (loading) {
		return (
			<div
				style={{
					minHeight: '100vh',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: '#090d16',
					color: '#94a3b8',
				}}>
				<p style={{ fontSize: '1.2rem', fontWeight: 500 }}>
					Loading presentation deck...
				</p>
			</div>
		)
	}

	if (!meta) {
		return (
			<div
				style={{
					minHeight: '100vh',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: '#090d16',
					color: '#f8fafc',
				}}>
				<h2>Presentation Deck Not Found</h2>
				<p style={{ color: '#94a3b8' }}>
					No presentation deck found at /pitch/{companySlug}
				</p>
			</div>
		)
	}

	return (
		<div
			style={{
				backgroundColor: '#090d16',
				minHeight: '100vh',
				color: '#f8fafc',
				padding: '24px 16px 60px 16px',
			}}>
			{/* Sticky Header */}
			<header
				style={{
					position: 'sticky',
					top: '16px',
					zIndex: 100,
					maxWidth: '1000px',
					margin: '0 auto 32px auto',
					backgroundColor: 'rgba(15, 23, 42, 0.85)',
					backdropFilter: 'blur(12px)',
					padding: '12px 24px',
					borderRadius: '12px',
					border: '1px solid #1e293b',
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
				}}>
				<div>
					<span
						style={{
							fontSize: '0.7rem',
							textTransform: 'uppercase',
							letterSpacing: '0.05em',
							color: '#64748b',
						}}>
						Pitch Deck For
					</span>
					<h1
						style={{
							margin: 0,
							fontSize: '1.25rem',
							color: '#ffffff',
						}}>
						{meta.companyName}
					</h1>
				</div>
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '16px',
					}}>
					<span
						style={{
							fontSize: '0.85rem',
							color: '#38bdf8',
							backgroundColor: '#0f172a',
							padding: '4px 12px',
							borderRadius: '20px',
							border: '1px solid #1e293b',
						}}>
						Slide {activeSlide} / {meta.slides.length}
					</span>
					<button
						onClick={handleCtaClick}
						style={{
							backgroundColor: '#2563eb',
							color: '#ffffff',
							border: 'none',
							padding: '8px 16px',
							borderRadius: '6px',
							fontWeight: 600,
							cursor: 'pointer',
							fontSize: '0.875rem',
						}}>
						Schedule Call
					</button>
				</div>
			</header>

			{/* Main Slide Stack */}
			<main
				style={{
					maxWidth: '1000px',
					margin: '0 auto',
					display: 'flex',
					flexDirection: 'column',
					gap: '40px',
				}}>
				{meta.slides.map((slide) => (
					<div
						key={slide.id}
						data-slide-id={slide.id}
						data-slide-number={slide.number}
						className='slide-card'
						style={{
							position: 'relative',
							width: '100%',
							aspectRatio: '16 / 9',
							backgroundColor: '#ffffff',
							borderRadius: '12px',
							overflow: 'hidden',
							boxShadow: '0 20px 30px -10px rgba(0,0,0,0.6)',
							border: '1px solid #1e293b',
						}}>
						<img
							src={slide.imageUrl}
							alt={`Slide ${slide.number}`}
							style={{
								width: '100%',
								height: '100%',
								objectFit: 'contain',
								display: 'block',
							}}
						/>

						{/* Extracted Clickable Link Hotspots */}
						{slide.links &&
							slide.links.map((link) => (
								<div
									key={link.id}
									onClick={() =>
										handleLinkClick(slide.number, link)
									}
									title={link.url}
									style={{
										position: 'absolute',
										top: link.top,
										left: link.left,
										width: link.width,
										height: link.height,
										cursor: 'pointer',
										backgroundColor:
											'rgba(37, 99, 235, 0.08)',
										border: '1px dashed #2563eb',
										borderRadius: '4px',
									}}
								/>
							))}
					</div>
				))}
			</main>
		</div>
	)
}
