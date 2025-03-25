'use client';

import { useConnectionManager } from '@/lib/hooks/useConnectionManager';

export default function ConnectionStatus() {
    const { isOnline, needsRefresh } = useConnectionManager();

    return (
        <>
            {/* Offline-Indikator */}
            {!isOnline && (
                <div className="fixed top-0 left-0 right-0 bg-yellow-500 text-white p-2 text-center z-50">
                    Offline-Modus - Einige Funktionen sind möglicherweise eingeschränkt
                </div>
            )}
            {/* Aktualisierungs-Indikator */}
            {needsRefresh && (
                <div className="fixed top-0 left-0 right-0 bg-blue-500 text-white p-2 text-center z-50">
                    Aktualisiere Daten...
                </div>
            )}
        </>
    );
} 