import JSZip from 'jszip'

export interface ParsedElement {
	id: string
	type: 'title' | 'heading' | 'text' | 'image' | 'list'
	content: string | string[]
}

export interface ParsedSlide {
	slideNumber: number
	elements: ParsedElement[]
}

export async function parsePptxFile(file: File): Promise<ParsedSlide[]> {
	const zip = new JSZip()
	const zipContent = await zip.loadAsync(file)

	// Find all slide XML files
	const slideFiles = Object.keys(zipContent.files).filter(
		(filename) =>
			filename.startsWith('ppt/slides/slide') &&
			filename.endsWith('.xml'),
	)

	// Sort slides numerically (slide1.xml, slide2.xml, ...)
	slideFiles.sort((a, b) => {
		const numA = parseInt(a.replace(/[^\d]/g, ''), 10)
		const numB = parseInt(b.replace(/[^\d]/g, ''), 10)
		return numA - numB
	})

	const parsedSlides: ParsedSlide[] = []

	for (let i = 0; i < slideFiles.length; i++) {
		const fileName = slideFiles[i]
		const xmlText = await zipContent.files[fileName].async('text')
		const parser = new DOMParser()
		const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

		const elements: ParsedElement[] = []

		// Extract text shape paragraphs (<a:p>)
		const paragraphs = Array.from(xmlDoc.getElementsByTagName('a:p'))
		const slideTextLines: string[] = []

		paragraphs.forEach((p) => {
			const textRuns = Array.from(p.getElementsByTagName('a:t'))
			const lineText = textRuns
				.map((r) => r.textContent || '')
				.join(' ')
				.trim()
			if (lineText) {
				slideTextLines.push(lineText)
			}
		})

		// Structure extracted lines dynamically into layout blocks
		slideTextLines.forEach((text, index) => {
			if (index === 0) {
				elements.push({ id: `e-${i}-0`, type: 'title', content: text })
			} else if (text.length < 60 && index === 1) {
				elements.push({
					id: `e-${i}-1`,
					type: 'heading',
					content: text,
				})
			} else if (text.startsWith('•') || text.startsWith('-')) {
				elements.push({
					id: `e-${i}-${index}`,
					type: 'list',
					content: [text.replace(/^[•-]\s*/, '')],
				})
			} else {
				elements.push({
					id: `e-${i}-${index}`,
					type: 'text',
					content: text,
				})
			}
		})

		parsedSlides.push({
			slideNumber: i + 1,
			elements:
				elements.length > 0
					? elements
					: [
							{
								id: `e-${i}-empty`,
								type: 'text',
								content: 'Slide content empty or image-only.',
							},
						],
		})
	}

	return parsedSlides
}
