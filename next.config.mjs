/** @type {import('next').NextConfig} */
import withPWA from 'next-pwa';

const nextConfig = {
    images: {
        domains: ['localhost'],
        formats: ['image/avif', 'image/webp'],
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
        minimumCacheTTL: 60,
    },
    reactStrictMode: false,
    experimental: {
        scrollRestoration: true,
        // Deaktiviere CSS-Optimierung um critters-Probleme zu vermeiden
        // optimizeCss: true,
        optimizePackageImports: ['react-dom', 'react', 'date-fns'],
        // nextScriptWorkers: true, // Entfernt, da es Partytown erfordert
    },
    output: 'standalone',
    compress: true,
    webpack: (config, { dev, isServer }) => {
        if (!dev && !isServer) {
            config.optimization.minimize = true;
        }
        return config;
    },
    headers: async () => {
        return [
            {
                source: '/:all*(svg|jpg|png|webp|avif|otf|ttf|woff|woff2)',
                locale: false,
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    }
                ],
            },
        ];
    },
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },
};

const pwaConfig = withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    runtimeCaching: [
        {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
        },
        {
            urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-font-assets',
                expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
        },
        {
            urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp|avif)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
                cacheName: 'static-image-assets',
                expiration: { maxEntries: 64, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
        },
    ],
})(nextConfig);

export default pwaConfig;
