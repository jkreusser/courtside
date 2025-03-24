'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Diese Komponente fügt clientseitiges JavaScript hinzu, um Seitenübergänge 
 * zu optimieren und Flackern zu reduzieren.
 */
function PageTransitionScriptContent() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Prüfe, ob es ein Mobilgerät ist
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

        // Für Mobilgeräte: Extrem vereinfachte Strategie ohne Verzögerungen
        if (isMobile) {
            // Füge "mobile"-Klasse zum <html>-Element hinzu
            document.documentElement.classList.add('mobile');

            // Keine Event-Listener oder Verzögerungen für mobile Geräte!
            // Minimaler Code für maximale Performance

            return () => {
                document.documentElement.classList.remove('mobile');
            };
        }
        // Desktop-Geräte: Verwende normale Übergänge
        else {
            // Speichere die Scroll-Position vor der Navigation
            const saveScrollPosition = (url) => {
                const scrollPos = {
                    x: window.scrollX,
                    y: window.scrollY
                };
                sessionStorage.setItem(`scrollPos:${url}`, JSON.stringify(scrollPos));
            };

            // Setze die gespeicherte Scroll-Position nach der Navigation
            const restoreScrollPosition = (url) => {
                try {
                    const scrollPos = JSON.parse(sessionStorage.getItem(`scrollPos:${url}`));
                    if (scrollPos) {
                        window.scrollTo(scrollPos.x, scrollPos.y);
                    }
                } catch (e) {
                    console.error('Fehler beim Wiederherstellen der Scroll-Position:', e);
                }
            };

            // Speichere aktuelle Position
            saveScrollPosition(pathname);

            // Verwalte Transitions
            const handleStartTransition = () => {
                const wrappers = document.querySelectorAll('.page-transition-wrapper');
                wrappers.forEach(wrapper => {
                    wrapper.classList.add('transitioning');
                });
            };

            const handleEndTransition = () => {
                const wrappers = document.querySelectorAll('.page-transition-wrapper');
                wrappers.forEach(wrapper => {
                    wrapper.classList.remove('transitioning');
                });
                // Stelle die Scroll-Position wieder her
                restoreScrollPosition(pathname);
            };

            // Führe Transition sofort aus, wenn die Komponente geladen wird
            setTimeout(handleEndTransition, 50);

            // Füge Event-Listener für die Navigation hinzu
            window.addEventListener('beforeunload', () => saveScrollPosition(pathname));

            return () => {
                window.removeEventListener('beforeunload', () => saveScrollPosition(pathname));
            };
        }
    }, [pathname, searchParams]);

    return null;
}

// Export der Komponente als Suspense-kompatible Funktion
export default function PageTransitionScript() {
    return (
        <PageTransitionScriptContent />
    );
} 