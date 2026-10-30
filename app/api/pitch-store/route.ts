import { NextResponse } from 'next/server'
import { pitchStore } from '@/lib/pitchStore'

export async function GET(req: Request) {
	const { searchParams } = new URL(req.url)
	const slug = searchParams.get('slug')

	if (slug) {
		const deck = pitchStore.get(slug)
		if (!deck) {
			return NextResponse.json(
				{ error: 'Pitch deck not found' },
				{ status: 404 },
			)
		}
		return NextResponse.json(deck)
	}

	return NextResponse.json({ decks: pitchStore.list() })
}
