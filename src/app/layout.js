import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import Header from "@/components/layout/Header";
import ToastProvider from "@/components/ui/ToastProvider";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "CourtSide",
  description: "Eine App für Squash-Spielpaarungen und Ranglisten.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ToastProvider />
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-1 container mx-auto px-4 py-4 sm:py-8">{children}</main>
            <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 py-4 sm:py-6">
              <div className="container mx-auto px-4 text-sm text-zinc-500 dark:text-zinc-400">
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
