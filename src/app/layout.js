import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/layout/Header";
import ToastProvider from "@/components/ui/ToastProvider";
import Link from "next/link";
import PageTransitionScript from "@/components/PageTransitionScript";

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
    statusBarStyle: "default",
    title: "CourtSide",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="theme-color" content="#FFFFFF" />
        {/* Performance Metatags */}
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta httpEquiv="Cache-Control" content="max-age=3600, public" />
        {/* Sofortiges Erkennen mobiler Geräte und Anwenden der Klasse vor Rendering */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                if (isMobile) document.documentElement.classList.add('mobile');
              } catch(e) {}
            })();
          `
        }} />
        <style>{`
          /* Grundlegende Layout-Stabilität */
          html, body {
            height: 100%;
            overflow-x: hidden;
          }
          
          /* Desktop-Übergänge */
          @media (min-width: 768px) {
            .page-transition-wrapper {
              transform: translateZ(0);
              transition: opacity 0.2s ease;
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
          <PageTransitionScript />
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">
              <div className="page-transition-wrapper">
                <div className="page-content">
                  {children}
                </div>
              </div>
            </main>
            <footer className="bg-zinc-950 border-t border-zinc-800 py-4 sm:py-6">
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
