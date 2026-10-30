import posthog from 'posthog-js'

export const initPostHog = () => {
	if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
		posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
			api_host:
				process.env.NEXT_PUBLIC_POSTHOG_HOST ||
				'https://app.posthog.com',
			loaded: (ph) => {
				if (process.env.NODE_ENV === 'development') ph.debug()
			},
		})
	}
}

export const trackEvent = (
	eventName: string,
	properties?: Record<string, any>,
) => {
	if (typeof window !== 'undefined') {
		if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
			posthog.capture(eventName, properties)
		}
		// Backup logging for local storage / admin stream
		try {
			const existing = JSON.parse(
				localStorage.getItem('kewordal_analytics_stream') || '[]',
			)
			const entry = {
				timestamp: new Date().toISOString(),
				eventName,
				properties,
			}
			localStorage.setItem(
				'kewordal_analytics_stream',
				JSON.stringify([entry, ...existing].slice(0, 200)),
			)
		} catch (e) {
			console.error(e)
		}
	}
}
