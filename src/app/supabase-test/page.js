"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, checkConnection } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth-context";
import { useTabVisibility, runWhenTabVisible, smartFetch } from '@/lib/tab-visibility-helper';

// Einfache Komponente zur Anzeige der Verbindungskonfiguration
function ConnectionStatus() {
    return (
        <div className="bg-zinc-800 p-4 rounded text-xs space-y-1">
            <div><b>Direkte Verbindung:</b> {process.env.NEXT_PUBLIC_USE_DIRECT_CONNECTION === 'true' ? 'Aktiv' : 'Inaktiv'}</div>
            <div><b>Supabase URL:</b> {process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20)}...</div>
            {process.env.NEXT_PUBLIC_USE_DIRECT_CONNECTION === 'true' && (
                <div><b>Direkte URL:</b> {process.env.NEXT_PUBLIC_SUPABASE_DIRECT_URL ?
                    process.env.NEXT_PUBLIC_SUPABASE_DIRECT_URL.substring(0, 20) + '...' : 'Nicht konfiguriert'}</div>
            )}
        </div>
    );
}

export default function SupabaseTestPage() {
    // Status für Daten
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastError, setLastError] = useState(null);

    // Status für Session und Benutzer
    const [session, setSession] = useState(null);

    // Status für Verbindung und Interaktion
    const [lastReload, setLastReload] = useState(0);
    const [displayTime, setDisplayTime] = useState('');
    const [requestId, setRequestId] = useState(0);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);

    // Tab-Visibility-Status
    const isTabVisible = useTabVisibility();

    // Auth-Context für Verbindungsstatus
    const { user, connectionStatus, checkConnection: authCheckConnection, attemptReconnect } = useAuth();

    // Refs für Zustandsverfolgung
    const fetchInProgress = useRef(false);
    const lastTabFocusTime = useRef(0);
    const pendingRequest = useRef(null);

    // Zeit-Anzeige nur clientseitig aktualisieren
    useEffect(() => {
        if (lastReload > 0) {
            setDisplayTime(new Date(lastReload).toLocaleTimeString());
        }
    }, [lastReload]);

    // Initialisiere lastReload nur auf Client-Seite
    useEffect(() => {
        // Setze mit Verzögerung, um Hydration-Fehler zu vermeiden
        const timer = setTimeout(() => {
            setLastReload(Date.now());
        }, 100); // Etwas länger warten für bessere Stabilität
        return () => clearTimeout(timer);
    }, []);

    // Zurücksetzen von hängenden Anfragen beim Tab-Wechsel
    useEffect(() => {
        if (!isTabVisible && fetchInProgress.current) {
            console.log("[fetchPlayers] Tab wurde inaktiv während einer Anfrage - Zurücksetzen");
            fetchInProgress.current = false;
            setLoading(false);

            // Speichere den letzten Fehler für Wiederherstellung
            if (error) {
                setLastError(error);
            }
        } else if (isTabVisible && lastError && !error) {
            // Wenn der Tab wieder aktiv wird und wir einen alten Fehler haben, zeige ihn
            console.log("[fetchPlayers] Tab wieder aktiv mit altem Fehler:", lastError);
            setError(lastError);
        }
    }, [isTabVisible, error, lastError]);

    // Tab-Wechsel-Handler
    useEffect(() => {
        if (isTabVisible && lastTabFocusTime.current > 0) {
            // Tab wurde aktiviert - versuche Verbindung wiederherzustellen nach kurzer Verzögerung
            const now = Date.now();
            const timeSinceLastFocus = now - lastTabFocusTime.current;

            // Nur wenn genug Zeit seit dem letzten Tab-Fokus vergangen ist
            if (timeSinceLastFocus > 5000) {
                console.log("[Tab] Tab aktiviert nach", Math.round(timeSinceLastFocus / 1000), "Sekunden");

                // Verzögerte Wiederherstellung der Verbindung
                const reconnectTimer = setTimeout(async () => {
                    if (isTabVisible) {
                        try {
                            // Versuche Verbindung wiederherzustellen
                            await attemptReconnect();
                            // Lade Daten neu
                            setLastReload(Date.now());
                        } catch (err) {
                            console.error("[Tab] Fehler bei Tab-Aktivierungs-Reconnect:", err);
                        }
                    }
                }, 2000);

                return () => clearTimeout(reconnectTimer);
            }
        }

        // Aktualisiere den letzten Tab-Fokus-Zeitstempel
        if (isTabVisible) {
            lastTabFocusTime.current = Date.now();
        }
    }, [isTabVisible, attemptReconnect]);

    // Session anzeigen
    useEffect(() => {
        const checkSession = async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (data?.session) {
                    setSession(data.session);
                    console.log("[Session] Gültige Session geladen");
                } else {
                    console.log("[Session] Keine Session vorhanden");
                }
            } catch (err) {
                console.error("[Session-Fehler]", err);
            }
        };

        checkSession();

        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            console.log("[AuthStateChange] Session aktualisiert");
        });

        return () => {
            listener?.subscription.unsubscribe();
        };
    }, []);

    // Daten laden mit Timeout und Logging
    const fetchPlayers = useCallback(async () => {
        // Verhindere mehrfache Aufrufe
        if (fetchInProgress.current) {
            console.log("[fetchPlayers] Eine Abfrage läuft bereits, überspringen");
            return;
        }

        if (lastReload === 0) return; // Nicht ausführen, wenn lastReload noch nicht initialisiert ist

        // Prüfe Tab-Visibility und führe nur in sichtbarem Tab aus oder verzögere
        if (!isTabVisible) {
            console.log("[fetchPlayers] Tab inaktiv, verzögere Anfrage");

            // Bei wiederholten Versuchen (nach einem Fehler) aufgeben
            if (reconnectAttempts > 0) {
                console.log("[fetchPlayers] Tab inaktiv und Wiederverbindungsversuch - aufgeben");
                setReconnectAttempts(0);
                return;
            }

            // Ausführung verzögern, bis Tab wieder aktiv ist
            pendingRequest.current = () => {
                console.log("[fetchPlayers] Tab wieder aktiv, führe verzögerte Anfrage aus");
                if (!fetchInProgress.current) {
                    setLastReload(Date.now());
                    pendingRequest.current = null;
                }
            };

            runWhenTabVisible(() => {
                if (pendingRequest.current) {
                    pendingRequest.current();
                }
            });
            return;
        }

        const thisRequest = requestId + 1;
        setRequestId(thisRequest);
        setLoading(true);
        setError(null);
        fetchInProgress.current = true;

        console.log(`[fetchPlayers] Start Request #${thisRequest}, Reconnect-Versuch ${reconnectAttempts}`);

        try {
            // Bei aufeinanderfolgenden Wiederverbindungsversuchen force=true verwenden
            const useForce = reconnectAttempts > 0;

            // Schlanke Verbindungsprüfung verwenden statt einer vollständigen
            let isConnected = false;
            let connectionCheckAttempts = 0;
            const maxConnectionCheckAttempts = useForce ? 1 : 3;

            while (connectionCheckAttempts < maxConnectionCheckAttempts) {
                if (!isTabVisible) {
                    console.log("[fetchPlayers] Tab wurde während Verbindungsprüfung inaktiv");
                    throw new Error("Tab wurde inaktiv");
                }

                try {
                    isConnected = await authCheckConnection(useForce || connectionCheckAttempts > 0);
                    break; // Erfolgreich, aus der Schleife ausbrechen
                } catch (connErr) {
                    console.warn(`[fetchPlayers] Verbindungsprüfung fehlgeschlagen (Versuch ${connectionCheckAttempts + 1}/${maxConnectionCheckAttempts}): ${connErr.message}`);
                    connectionCheckAttempts++;

                    if (connectionCheckAttempts >= maxConnectionCheckAttempts) {
                        console.error("[fetchPlayers] Maximale Verbindungsprüfungen erreicht");
                        throw new Error("Verbindungsprüfung fehlgeschlagen");
                    }

                    // Kurze Verzögerung vor dem nächsten Versuch
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!isConnected) {
                console.warn("[fetchPlayers] Verbindung getrennt - Breche Abfrage ab");
                setError("Keine Verbindung zur Datenbank. Bitte stellen Sie sicher, dass Sie online sind.");
                setLoading(false);
                fetchInProgress.current = false;

                // Bei wiederholt fehlgeschlagener Verbindung längere Wartezeit
                if (reconnectAttempts > 0) {
                    console.warn(`[fetchPlayers] ${reconnectAttempts} fehlgeschlagene Wiederverbindungsversuche`);
                    setReconnectAttempts(reconnectAttempts + 1);
                }

                return;
            }

            // Reset Wiederverbindungsversuchszähler nach erfolgreicher Verbindung
            if (reconnectAttempts > 0) {
                setReconnectAttempts(0);
            }

            // Verwende smartFetch statt direktem fetch über den Supabase-Client
            try {
                console.log('[fetchPlayers] Starte Datenbankabfrage...');
                const start = Date.now();

                // Verwende den regulären Supabase-Client, statt direktem fetch
                // Dies ist zuverlässiger und nutzt vorhandene Authentifizierung
                const { data, error } = await supabase
                    .from('players')
                    .select('id, name')
                    .limit(10);

                if (error) {
                    throw error;
                }

                const duration = Date.now() - start;

                console.log(`[fetchPlayers] Datenbankabfrage abgeschlossen in ${duration}ms`);

                // Debug-Ausgabe für bessere Diagnose
                const playerCount = data?.length || 0;
                console.log(`[fetchPlayers] Success Request #${thisRequest}:`, {
                    playerCount,
                    firstPlayer: playerCount > 0 ? {
                        id: data[0].id,
                        name: data[0].name
                    } : 'keine Spieler',
                    durationMs: duration
                });

                // Setze Spielerdaten
                setPlayers(data || []);

                if (playerCount === 0) {
                    console.log("[fetchPlayers] Keine Spieler in der Datenbank gefunden");
                }
            } catch (err) {
                console.error(`[fetchPlayers] Abfragefehler:`, err);

                // Prüfe, ob es ein Abbruch durch Timeout war
                if (err.name === 'AbortError') {
                    setError('Die Anfrage wurde wegen Zeitüberschreitung abgebrochen.');

                    // Bei Timeout direkt eine neue Verbindungsprüfung durchführen
                    console.log("[fetchPlayers] Verbindungsprüfung nach Timeout");
                    await authCheckConnection(true);

                    // Wiederverbindungsversuch starten
                    setReconnectAttempts(prev => prev + 1);

                } else if (err.message?.includes('Failed to fetch') ||
                    err.message?.includes('NetworkError') ||
                    err.message?.includes('network') ||
                    err.message?.includes('timeout') ||
                    err.message?.includes('Network request failed')) {
                    // Verbindungsproblem erkannt
                    setError(`Verbindungsproblem: ${err.message}`);

                    // Automatischer Reconnect-Versuch mit einfacherem Timing und maximaler Anzahl
                    if (reconnectAttempts < 3) {
                        setTimeout(async () => {
                            if (isTabVisible) {
                                console.log(`[fetchPlayers] Automatischer Reconnect-Versuch #${reconnectAttempts + 1} nach Fehler`);
                                try {
                                    const reconnected = await attemptReconnect();

                                    if (reconnected) {
                                        console.log("[fetchPlayers] Verbindung wiederhergestellt - Versuche erneut");
                                        // Neuladen mit Verzögerung
                                        setTimeout(() => {
                                            setReconnectAttempts(prev => prev + 1);
                                            setLastReload(Date.now());
                                        }, 500);
                                    } else {
                                        console.warn("[fetchPlayers] Verbindung konnte nicht wiederhergestellt werden");
                                        setReconnectAttempts(prev => prev + 1);
                                    }
                                } catch (reconnectErr) {
                                    console.error("[fetchPlayers] Fehler beim Reconnect-Versuch:", reconnectErr);
                                    setReconnectAttempts(prev => prev + 1);
                                }
                            } else {
                                console.log("[fetchPlayers] Wiederverbindung abgebrochen - Tab inaktiv");
                            }
                        }, 1500);
                    } else {
                        console.warn("[fetchPlayers] Maximale Anzahl an Wiederverbindungsversuchen erreicht");
                    }
                } else {
                    // Andere Fehler
                    setError(err.message || JSON.stringify(err));
                }

                setPlayers([]);
            } finally {
                setLoading(false);
                console.log(`[fetchPlayers] End Request #${thisRequest}`);
                fetchInProgress.current = false;
            }
        } catch (err) {
            setLoading(false);
            setError("Unerwarteter Fehler: " + (err.message || "Unbekannter Fehler"));
            console.error(`[fetchPlayers] Unerwarteter Fehler:`, err);
            fetchInProgress.current = false;
        }
    }, [requestId, authCheckConnection, attemptReconnect, lastReload, isTabVisible, reconnectAttempts]);

    // Bei Reload-Änderung und sichtbarem Tab Daten neu laden
    useEffect(() => {
        if (lastReload === 0) return;

        // Nur laden, wenn der Tab sichtbar ist
        if (isTabVisible) {
            console.log(`[App] Lade Daten (Reload: ${new Date(lastReload).toLocaleTimeString()}, Tab sichtbar: ${isTabVisible})`);
            fetchPlayers();
        } else {
            console.log(`[App] Tab nicht sichtbar, verzögere Datenladung`);
        }
    }, [lastReload, fetchPlayers, isTabVisible]);

    // Sofortige Verbindungsprüfung beim Start, aber nur bei sichtbarem Tab
    useEffect(() => {
        if (lastReload === 0 || !isTabVisible) return;

        let isMounted = true;
        let retryAttempts = 0;
        const maxRetries = 2; // Reduziert von 3

        const initialCheck = async () => {
            try {
                // Verwende force=false, da wir jetzt Verbindungsprüfungs-Promises wiederverwenden
                // und so mehrere parallele Anfragen vermeiden
                const connected = await authCheckConnection(false);

                if (!isMounted) return;

                if (connected) {
                    console.log('[App] Initiale Verbindung OK');
                    retryAttempts = 0;
                } else {
                    console.warn('[App] Initiale Verbindungsprüfung fehlgeschlagen');

                    if (retryAttempts < maxRetries) {
                        // Schnelleres Backoff für Wiederholungsversuche
                        const retryDelay = 1000 * (retryAttempts + 1); // Einfacher linearer Rückzug
                        retryAttempts++;

                        console.log(`[App] Wiederholungsversuch ${retryAttempts}/${maxRetries} in ${retryDelay}ms`);

                        // Timeout für erneuten Versuch
                        if (isMounted) {
                            setTimeout(initialCheck, retryDelay);
                        }
                    } else {
                        console.error('[App] Maximale Anzahl an Wiederverbindungsversuchen erreicht');
                        setError('Verbindung zur Datenbank konnte nicht hergestellt werden');
                    }
                }
            } catch (err) {
                if (!isMounted) return;

                console.error('[App] Fehler bei initialer Verbindungsprüfung:', err.message);

                if (retryAttempts < maxRetries) {
                    // Schnelleres Backoff für Wiederholungsversuche
                    const retryDelay = 1000 * (retryAttempts + 1); // Einfacher linearer Rückzug
                    retryAttempts++;

                    console.log(`[App] Wiederholungsversuch nach Fehler ${retryAttempts}/${maxRetries} in ${retryDelay}ms`);

                    // Timeout für erneuten Versuch
                    if (isMounted) {
                        setTimeout(initialCheck, retryDelay);
                    }
                } else {
                    console.error('[App] Maximale Anzahl an Wiederverbindungsversuchen nach Fehler erreicht');
                    setError('Fehler bei der Verbindungsprüfung: ' + (err.message || 'Unbekannter Fehler'));
                }
            }
        };

        // Starte die initiale Prüfung
        initialCheck();

        return () => {
            isMounted = false;
        };
    }, [authCheckConnection, lastReload, isTabVisible]);

    return (
        <div className="max-w-xl mx-auto p-8 space-y-4">
            <h1 className="text-2xl font-bold">Supabase Connection Test 🚀</h1>

            {/* Verbindungskonfiguration anzeigen */}
            <ConnectionStatus />

            <div className="bg-gray-100 rounded p-4 text-xs space-y-1">
                <div><b>Session:</b> {session ? "Vorhanden" : "Keine Session"}</div>
                <div><b>User ID:</b> {user?.id || "-"}</div>
                <div><b>Verbindung:</b> <span className={
                    connectionStatus === "connected" ? "text-green-600 font-bold" :
                        connectionStatus === "disconnected" ? "text-red-600 font-bold" :
                            connectionStatus === "error" ? "text-orange-600 font-bold" :
                                "text-gray-500"
                }>{connectionStatus || "unbekannt"}</span></div>
                <div><b>Tab sichtbar:</b> <span className={isTabVisible ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                    {isTabVisible ? "Ja" : "Nein"}
                </span></div>
                <div><b>Wiederverbindungen:</b> {reconnectAttempts} Versuche</div>
            </div>

            <div className="flex gap-2">
                <button
                    className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/80"
                    onClick={() => {
                        console.log("[Button] Manuell neu laden");
                        setLastReload(Date.now());
                    }}
                    disabled={loading}
                >
                    {loading ? "Lädt..." : "Daten laden"}
                </button>
                <button
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                    onClick={async () => {
                        console.log("[Button] Verbindung prüfen");
                        await authCheckConnection(true);
                    }}
                    disabled={loading}
                >
                    {loading ? "Prüfe..." : "Verbindung prüfen"}
                </button>
                <button
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
                    onClick={async () => {
                        console.log("[Button] Verbindung wiederherstellen");
                        const success = await attemptReconnect();
                        if (success) {
                            setLastReload(Date.now());
                        }
                    }}
                    disabled={loading}
                >
                    Verbindung wiederherstellen
                </button>
            </div>
            <div>
                {loading && <div className="text-blue-500">Lade Spieler...</div>}
                {error && <div className="text-red-500">Fehler: {error}</div>}
                <ul className="mt-2 list-disc list-inside">
                    {players.map((p) => (
                        <li key={p.id}>{p.name} (ID: {p.id})</li>
                    ))}
                </ul>
                {!loading && !error && players.length === 0 && (
                    <div className="text-gray-500">Keine Spieler gefunden.</div>
                )}
            </div>
            <div className="text-xs text-gray-400 mt-8">
                {displayTime ? `Letztes Laden: ${displayTime}` : ''}
                {!isTabVisible && <span className="ml-2 text-amber-500">(Tab inaktiv - Anfragen verzögert)</span>}
            </div>
        </div>
    );
} 