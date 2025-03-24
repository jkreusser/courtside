import Link from 'next/link';

export default function Custom404() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] py-12 px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">404 - Seite nicht gefunden</h1>
            <p className="text-lg mb-8 text-zinc-400 max-w-lg">
                Die gesuchte Seite existiert nicht oder wurde verschoben.
            </p>
            <Link
                href="/"
                className="bg-primary text-black font-medium py-3 px-6 rounded-lg hover:bg-opacity-90 transition-colors"
            >
                Zurück zur Startseite
            </Link>
        </div>
    );
} 