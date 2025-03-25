export const metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    title: {
        template: '%s - CourtSide',
        default: 'CourtSide'
    },
    description: "Eine App für Squash-Spielpaarungen und Ranglisten.",
    manifest: "/manifest.json",
    appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: "CourtSide",
        startupImage: [
            {
                url: "/splash/apple-splash-2048-2732.png",
                media: "(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)"
            },
            {
                url: "/splash/apple-splash-1668-2388.png",
                media: "(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)"
            },
            {
                url: "/splash/apple-splash-1536-2048.png",
                media: "(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)"
            },
            {
                url: "/splash/apple-splash-1125-2436.png",
                media: "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
            }
        ]
    },
    formatDetection: {
        telephone: false,
    },
    alternates: {
        canonical: '/',
        languages: {
            'de': '/'
        }
    },
    openGraph: {
        type: 'website',
        locale: 'de_DE',
        url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        siteName: 'CourtSide',
        images: [
            {
                url: '/images/og-image.png',
                width: 1200,
                height: 630,
                alt: 'CourtSide'
            }
        ]
    }
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
}; 