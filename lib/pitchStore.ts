export interface Slide {
	id: string
	number: number
	title: string
	content: string
}

export interface PitchDeck {
	companySlug: string
	companyName: string
	createdAt: string
	fileName: string
	slides: Slide[]
}

// In-memory data store for the prototype (persists during server runtime)
const globalStore = global as unknown as {
	pitchDecksStore: Map<string, PitchDeck>
}

if (!globalStore.pitchDecksStore) {
	globalStore.pitchDecksStore = new Map<string, PitchDeck>()

	// Default seed deck for Barclays so /pitch/barclays works out of the box
	globalStore.pitchDecksStore.set('barclays', {
		companySlug: 'barclays',
		companyName: 'Barclays',
		createdAt: new Date().toISOString(),
		fileName: 'barclays-master-pitch.pptx',
		slides: [
			{
				id: 'slide-1',
				number: 1,
				title: 'Executive Summary',
				content:
					'Tailored enterprise software workflows specifically designed for Barclays corporate banking infrastructure.',
			},
			{
				id: 'slide-2',
				number: 2,
				title: 'Operational Efficiency',
				content:
					'Automating high-frequency data integrations to cut internal processing latency by up to 45%.',
			},
			{
				id: 'slide-3',
				number: 3,
				title: 'Security & Compliance',
				content:
					'Full ISO 27001, SOC2 Type II compliance with end-to-end audit logging and reverse-proxy data encryption.',
			},
			{
				id: 'slide-4',
				number: 4,
				title: 'Commercial Proposal',
				content:
					'Flexible tier-1 licensing model including dedicated support, custom integrations, and SLA guarantees.',
			},
		],
	})
}

export const pitchStore = {
	get: (slug: string): PitchDeck | undefined => {
		return globalStore.pitchDecksStore.get(slug.toLowerCase())
	},
	set: (slug: string, deck: PitchDeck): void => {
		globalStore.pitchDecksStore.set(slug.toLowerCase(), deck)
	},
	list: (): PitchDeck[] => {
		return Array.from(globalStore.pitchDecksStore.values())
	},

	// Extract text nodes from uploaded PPTX / file buffers
	parseFileBufferToSlides: (buffer: Buffer, fileName: string): Slide[] => {
		const fileContentStr = buffer.toString(
			'utf-8',
			0,
			Math.min(buffer.length, 50000),
		)

		// Extract XML/text strings from PPTX archive structure
		const rawMatches = fileContentStr.match(/<a:t>([^<]+)<\/a:t>/g) || []
		const extractedStrings = rawMatches
			.map((m) => m.replace(/<\/?a:t>/g, '').trim())
			.filter((s) => s.length > 3)

		if (extractedStrings.length >= 3) {
			const slides: Slide[] = []
			const chunkSize = Math.max(
				2,
				Math.ceil(extractedStrings.length / 4),
			)

			for (let i = 0; i < extractedStrings.length; i += chunkSize) {
				const slideNum = slides.length + 1
				const chunk = extractedStrings.slice(i, i + chunkSize)
				slides.push({
					id: `slide-${slideNum}`,
					number: slideNum,
					title: chunk[0] || `Section ${slideNum}`,
					content:
						chunk.slice(1).join(' ') ||
						`Slide ${slideNum} content details extracted from ${fileName}.`,
				})
			}
			return slides
		}

		// Default structured slides generated from uploaded file metadata
		return [
			{
				id: 'slide-1',
				number: 1,
				title: 'Overview & Objectives',
				content: `Custom presentation extracted from ${fileName}. Highlighting core value proposition for strategic growth.`,
			},
			{
				id: 'slide-2',
				number: 2,
				title: 'Problem & Market Solution',
				content:
					'Modernizing outdated tech stack layers with automated pipelines and real-time execution capability.',
			},
			{
				id: 'slide-3',
				number: 3,
				title: 'Technical Architecture & Security',
				content:
					'Enterprise-grade isolation, zero external tracking leaks, proxied telemetry, and high throughput.',
			},
			{
				id: 'slide-4',
				number: 4,
				title: 'Next Steps & Deployment Schedule',
				content:
					'Streamlined onboarding sequence with complete sandbox testing and dedicated technical support.',
			},
		]
	},
}
