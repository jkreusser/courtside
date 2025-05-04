/**
 * Tab-Visibility-Helper
 * 
 * Dieses Modul hilft bei der Behandlung von Browser-Drosselung in inaktiven Tabs.
 * Browser (insbesondere Chrome) drosseln Hintergrund-Tabs, was zu Timeout-Problemen führen kann.
 */

import { useEffect, useState, useCallback } from 'react';

/**
 * Hook zum Überwachen des Tab-Zustands
 * Gibt zurück, ob der Tab aktiv ist und eine Funktion zum manuellen Aktualisieren
 */
export function useTabVisibility() {
    const [isVisible, setIsVisible] = useState(
        typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
    );

    useEffect(() => {
        const handleVisibilityChange = () => {
            const visible = document.visibilityState === 'visible';
            setIsVisible(visible);
            console.log(`[Visibility] Tab ist jetzt ${visible ? 'sichtbar' : 'versteckt'}`);
        };

        const handleFocus = () => {
            setIsVisible(true);
            console.log('[Visibility] Fenster hat Fokus erhalten');
        };

        const handleBlur = () => {
            setIsVisible(false);
            console.log('[Visibility] Fenster hat Fokus verloren');
        };

        // Initialen Zustand setzen
        if (typeof document !== 'undefined') {
            setIsVisible(document.visibilityState === 'visible');
        }

        // Event-Listener für Sichtbarkeitsänderungen
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, []);

    return isVisible;
}

/**
 * Optimiertes Polling für Hintergrund-Tabs
 * Passt die Polling-Intervalle basierend auf Tab-Sichtbarkeit an
 */
export function useSmartPolling(callback, options = {}) {
    const {
        activeInterval = 3000,      // Polling-Intervall bei aktivem Tab (in ms)
        inactiveInterval = 10000,   // Polling-Intervall bei inaktivem Tab (in ms)
        initialDelay = 0,           // Verzögerung vor dem ersten Polling
        enabled = true              // Ob Polling aktiviert ist
    } = options;

    const isVisible = useTabVisibility();
    const [timerId, setTimerId] = useState(null);

    const stopPolling = useCallback(() => {
        if (timerId) {
            clearInterval(timerId);
            setTimerId(null);
        }
    }, [timerId]);

    const startPolling = useCallback(() => {
        if (!enabled) return;

        stopPolling();

        // Erste Ausführung nach initialDelay
        const initialTimer = setTimeout(() => {
            // Führe Callback sofort aus
            callback();

            // Dann starte das regelmäßige Polling mit angepasstem Intervall
            const interval = isVisible ? activeInterval : inactiveInterval;
            const newTimerId = setInterval(() => {
                callback();
            }, interval);

            setTimerId(newTimerId);
        }, initialDelay);

        return () => clearTimeout(initialTimer);
    }, [callback, activeInterval, inactiveInterval, initialDelay, isVisible, enabled, stopPolling]);

    // Bei Änderung der Tab-Sichtbarkeit oder der Intervalle das Polling neu starten
    useEffect(() => {
        if (enabled) {
            startPolling();
        } else {
            stopPolling();
        }

        return stopPolling;
    }, [isVisible, activeInterval, inactiveInterval, enabled, startPolling, stopPolling]);

    return {
        isPolling: !!timerId,
        isVisible,
        startPolling,
        stopPolling
    };
}

/**
 * Führt eine Operation nur aus, wenn der Tab aktiv ist,
 * sonst wird sie verzögert, bis der Tab wieder aktiv wird
 */
export async function runWhenTabVisible(operation) {
    return new Promise((resolve) => {
        const execute = async () => {
            try {
                const result = await operation();
                resolve(result);
            } catch (error) {
                console.error('[TabVisibility] Fehler bei verzögerter Operation:', error);
                resolve(null);
            }
            document.removeEventListener('visibilitychange', visibilityCheck);
        };

        const visibilityCheck = () => {
            if (document.visibilityState === 'visible') {
                execute();
            }
        };

        if (document.visibilityState === 'visible') {
            // Sofort ausführen, wenn Tab sichtbar ist
            execute();
        } else {
            // Auf Sichtbarkeit warten
            console.log('[TabVisibility] Tab ist versteckt, warte auf Aktivierung');
            document.addEventListener('visibilitychange', visibilityCheck);
        }
    });
}

/**
 * Erstellt einen optimierten Fetch-Wrapper, der bei inaktiven Tabs
 * entweder wartet oder mit angepasstem Timeout arbeitet
 */
export function createSmartFetch(options = {}) {
    const {
        waitForVisibility = true,         // Ob auf Tab-Sichtbarkeit gewartet werden soll
        visibleTimeout = 30000,           // Timeout bei sichtbarem Tab (30s)
        hiddenTimeout = 5000,             // Timeout bei verstecktem Tab (5s)
        retryOnTabActivation = true       // Ob fehlgeschlagene Requests wiederholt werden sollen
    } = options;

    // Liste von Fetch-Anfragen, die wiederholt werden sollen
    const pendingRetries = [];

    // Event-Listener für Tab-Aktivierung
    if (retryOnTabActivation && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && pendingRetries.length > 0) {
                console.log(`[SmartFetch] Tab aktiviert, wiederhole ${pendingRetries.length} Anfragen`);

                // Kopiere und leere die Liste, um Race-Conditions zu vermeiden
                const retriesToProcess = [...pendingRetries];
                pendingRetries.length = 0;

                // Wiederhole alle gespeicherten Anfragen
                retriesToProcess.forEach(retry => {
                    setTimeout(() => {
                        try {
                            retry();
                        } catch (err) {
                            console.error('[SmartFetch] Fehler beim Wiederholen:', err);
                        }
                    }, 500);
                });
            }
        });
    }

    // Der eigentliche Fetch-Wrapper
    return async function smartFetch(url, options = {}) {
        const isVisible = document.visibilityState === 'visible';

        // Wenn wir auf Sichtbarkeit warten sollen und der Tab versteckt ist
        if (waitForVisibility && !isVisible) {
            return new Promise((resolve, reject) => {
                const retryFn = () => {
                    // Aus der Warteliste entfernen
                    const index = pendingRetries.indexOf(retryFn);
                    if (index >= 0) pendingRetries.splice(index, 1);

                    // Erneut versuchen, wenn der Tab aktiv wird
                    smartFetch(url, options).then(resolve).catch(reject);
                };

                // Zur Warteliste hinzufügen
                pendingRetries.push(retryFn);
                console.log('[SmartFetch] Tab versteckt, Anfrage verzögert:', url);
            });
        }

        // Timeout basierend auf Tab-Sichtbarkeit setzen
        const timeout = isVisible ? visibleTimeout : hiddenTimeout;

        // AbortController für Timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
        }, timeout);

        try {
            // Bestehenden signal mit neuem kombinieren, falls vorhanden
            const signal = options.signal
                ? combineAbortSignals(options.signal, controller.signal)
                : controller.signal;

            const response = await fetch(url, {
                ...options,
                signal
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);

            // Bei Timeout oder Netzwerkfehler, zur Wiederholungsliste hinzufügen
            if (retryOnTabActivation && !isVisible &&
                (error.name === 'AbortError' || error.message?.includes('fetch'))) {
                return new Promise((resolve, reject) => {
                    const retryFn = () => {
                        // Aus der Warteliste entfernen
                        const index = pendingRetries.indexOf(retryFn);
                        if (index >= 0) pendingRetries.splice(index, 1);

                        // Erneut versuchen
                        smartFetch(url, options).then(resolve).catch(reject);
                    };

                    pendingRetries.push(retryFn);
                    console.log('[SmartFetch] Anfrage fehlgeschlagen, wird wiederholt bei Tab-Aktivierung:', url);
                });
            }

            throw error;
        }
    };
}

// Hilfsfunktion zum Kombinieren mehrerer AbortSignals
function combineAbortSignals(...signals) {
    const controller = new AbortController();

    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort();
            break;
        }

        signal.addEventListener('abort', () => controller.abort());
    }

    return controller.signal;
}

// Exportiere eine Singleton-Instanz von smartFetch mit Standardoptionen
export const smartFetch = createSmartFetch(); 