import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

function extractLinksFromRelsXml(xmlContent: string) {
	const links: Array<{ id: string; url: string }> = []
	const relationshipRegex = /<Relationship\s+([^>]+)>/g
	let match

	while ((match = relationshipRegex.exec(xmlContent)) !== null) {
		const attrStr = match[1]
		const idMatch = attrStr.match(/Id="([^"]+)"/)
		const typeMatch = attrStr.match(/Type="([^"]*hyperlink[^"]*)"/)
		const targetMatch = attrStr.match(/Target="([^"]+)"/)

		if (typeMatch && targetMatch && idMatch) {
			links.push({
				id: idMatch[1],
				url: targetMatch[1],
			})
		}
	}
	return links
}

export async function POST(req: Request) {
	try {
		const formData = await req.formData()
		const file = formData.get('file') as File | null
		const companyName = formData.get('companyName') as string | null

		if (!file || !companyName) {
			return NextResponse.json(
				{ error: 'File and target company name are required' },
				{ status: 400 },
			)
		}

		const companySlug = companyName
			.toLowerCase()
			.replace(/[^a-z0-9]/g, '-')
			.replace(/-+/g, '-')
		const uploadDir = path.join(
			process.cwd(),
			'public',
			'uploads',
			companySlug,
		)
		const tempExtractDir = path.join(uploadDir, 'temp_raw')

		await fs.mkdir(uploadDir, { recursive: true })
		await fs.mkdir(tempExtractDir, { recursive: true })

		// 1. Write uploaded PPTX file to disk
		const bytes = await file.arrayBuffer()
		const buffer = Buffer.from(bytes)
		const pptxPath = path.join(uploadDir, 'presentation.pptx')
		await fs.writeFile(pptxPath, buffer)

		// 2. Extract PPTX archive to read internal relationship XMLs for embedded links
		await execAsync(`unzip -q ${pptxPath} -d ${tempExtractDir}`)

		// 3. Convert PPTX to PDF using LibreOffice
		await execAsync(
			`libreoffice --headless --convert-to pdf ${pptxPath} --outdir ${uploadDir}`,
		)
		const pdfPath = path.join(uploadDir, 'presentation.pdf')

		// 4. Convert PDF pages to high-res PNG slide images at 300 DPI
		await execAsync(
			`pdftoppm -png -r 300 ${pdfPath} ${path.join(uploadDir, 'slide')}`,
		)

		// 5. Read generated slide PNGs
		const files = await fs.readdir(uploadDir)
		const slideImages = files
			.filter((f) => f.startsWith('slide-') && f.endsWith('.png'))
			.sort((a, b) => {
				const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0
				const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0
				return numA - numB
			})

		// 6. Parse dynamic links per slide directly from extracted XML files
		const slidesMeta = await Promise.all(
			slideImages.map(async (fileName, index) => {
				const slideNum = index + 1
				const relsPath = path.join(
					tempExtractDir,
					'ppt',
					'slides',
					'_rels',
					`slide${slideNum}.xml.rels`,
				)

				let slideLinks: Array<{
					id: string
					label: string
					url: string
					top: string
					left: string
					width: string
					height: string
				}> = []

				try {
					const relsContent = await fs.readFile(relsPath, 'utf8')
					const rawLinks = extractLinksFromRelsXml(relsContent)

					slideLinks = rawLinks.map((lnk, linkIdx) => ({
						id: lnk.id,
						label: `Embedded Link ${linkIdx + 1}`,
						url: lnk.url,
						top: `${20 + linkIdx * 15}%`,
						left: '10%',
						width: '80%',
						height: '12%',
					}))
				} catch (e) {
					// No rels file present (no links on this slide)
				}

				return {
					id: `slide-${slideNum}`,
					number: slideNum,
					imageUrl: `/uploads/${companySlug}/${fileName}`,
					links: slideLinks,
				}
			}),
		)

		// Clean up temporary extraction folder
		await fs.rm(tempExtractDir, { recursive: true, force: true })

		// 7. Write metadata JSON
		const metadata = {
			companyName,
			companySlug,
			slides: slidesMeta,
			createdAt: new Date().toISOString(),
		}

		await fs.writeFile(
			path.join(uploadDir, 'metadata.json'),
			JSON.stringify(metadata, null, 2),
		)

		return NextResponse.json({
			success: true,
			url: `/pitch/${companySlug}`,
			slideCount: slidesMeta.length,
		})
	} catch (error: any) {
		console.error('PPTX Processing Error:', error)
		return NextResponse.json(
			{ error: error.message || 'Failed to convert presentation deck.' },
			{ status: 500 },
		)
	}
}
