'use client';

import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Suspense } from 'react';

function ImpressumContent() {
    return (
        <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6">Impressum</h1>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Angaben gemäß § 5 TMG</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p>Joschka Kreusser</p>
                    <p>Falkenstr. 11F</p>
                    <p>81541 München</p>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Kontakt</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Email: info[at]joschka-kreusser[punkt]de</p>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Umsatzsteuer-ID</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a Umsatzsteuergesetz: DE344955287</p>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>EU-Streitschlichtung</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <Link href="https://ec.europa.eu/consumers/odr/" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</Link>. Unsere E-Mail-Adresse finden Sie oben im Impressum.</p>
                </CardContent>
            </Card>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Verbraucherstreitbeilegung / Universalschlichtungsstelle</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Wir nehmen an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil. Zuständig ist die Universalschlichtungsstelle des Zentrums für Schlichtung e.V., Straßburger Straße 8, 77694 Kehl am Rhein (<Link href="https://www.verbraucher-schlichter.de" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">https://www.verbraucher-schlichter.de</Link>).</p>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ImpressumPage() {
    return (
        <Suspense fallback={<div className="text-center py-12">Impressum wird geladen...</div>}>
            <ImpressumContent />
        </Suspense>
    );
} 