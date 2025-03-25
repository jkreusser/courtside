import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/layout/Header";
import ToastProvider from "@/components/ui/ToastProvider";
import Link from "next/link";
import PageTransitionScript from "@/components/PageTransitionScript";
import { Suspense } from "react";
import ConnectionStatus from "@/components/layout/ConnectionStatus";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  fallback: ['system-ui', 'sans-serif'],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ['monospace'],
});

export const metadata = {
  title: "CourtSide",
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
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* PWA Icons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="384x384" href="/icons/icon-384x384.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512x512.png" />
        <meta name="theme-color" content="#7BF1A8" />
        {/* Performance Metatags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CourtSide" />
        <meta httpEquiv="Cache-Control" content="max-age=3600, public" />
        {/* iOS-spezifische Meta-Tags */}
        <meta name="apple-touch-fullscreen" content="yes" />
        <meta name="apple-mobile-web-app-orientations" content="portrait" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Sofortiges Erkennen mobiler Geräte und iOS */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
                if (isMobile) document.documentElement.classList.add('mobile');
                if (isIOS) {
                  document.documentElement.classList.add('ios');
                  // Verhindern von elastischem Scrollen auf iOS
                  document.documentElement.style.overflow = window.navigator.standalone ? 'hidden' : 'auto';
                  // Verhindern von Doppeltipp-Zoom
                  document.documentElement.addEventListener('touchstart', function(e) {
                    if (e.touches.length > 1) e.preventDefault();
                  }, { passive: false });
                }
              } catch(e) {}
            })();
          `
        }} />
        <style>{`
          /* Grundlegende Layout-Stabilität */
          html, body {
            height: 100%;
            overflow-x: hidden;
            -webkit-tap-highlight-color: transparent;
            overscroll-behavior-y: none; /* Verhindert Pull-to-Refresh */
          }
          
          /* iOS-spezifische Anpassungen */
          .ios {
            -webkit-touch-callout: none;
            -webkit-user-select: none;
            user-select: none;
          }
          
          /* Verbesserte iOS Standalone Anpassungen */
          @supports (-webkit-touch-callout: none) {
            .ios.standalone {
              height: 100vh;
              height: -webkit-fill-available;
              overflow: auto;
              -webkit-overflow-scrolling: touch;
            }

            .ios.standalone .flex-col {
              min-height: 100vh;
              min-height: -webkit-fill-available;
            }

            .ios.standalone .page-content {
              position: relative;
              z-index: 1;
              flex: 1;
              overflow: auto;
              -webkit-overflow-scrolling: touch;
            }
          }
          
          /* Desktop-Übergänge */
          @media (min-width: 768px) {
            .page-transition-wrapper {
              transform: translateZ(0);
              transition: opacity 0.2s ease;
              will-change: opacity;
              backface-visibility: hidden;
            }
            
            .page-content {
              min-height: calc(100vh - 160px);
            }
          }
          
          /* Mobile: KEINE Übergänge! */
          @media (max-width: 767px) {
            * {
              transition: none !important;
              animation: none !important;
            }
            
            .page-transition-wrapper {
              transition: none !important;
              opacity: 1 !important;
            }
          }
        `}</style>
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ToastProvider />
          <Suspense fallback={null}>
            <PageTransitionScript />
          </Suspense>
          <div className="flex flex-col min-h-screen">
            <div className="relative z-10">
              <Header />
            </div>
            <main className="flex-1 container mx-auto px-4 py-4 sm:py-8 relative z-1">
              <div className="page-transition-wrapper">
                <div className="page-content">
                  <Suspense fallback={null}>
                    <ConnectionStatus />
                  </Suspense>
                  {children}
                </div>
              </div>
            </main>
            <footer className="bg-zinc-950 border-t border-zinc-800 py-4 sm:py-6 pb-20 md:pb-6 relative z-10">
              <div className="container mx-auto px-4 text-sm text-zinc-400">
                <div className="flex justify-between items-center">
                  <div>&copy; 2025 CourtSide</div>
                  <div>
                    <Link href="/impressum" className="hover:text-primary hover:underline transition-colors">
                      Impressum
                    </Link>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
