import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../auth-context';

const HEARTBEAT_INTERVAL = 30000; // 30 Sekunden
const REFRESH_INTERVAL = 60000; // 1 Minute
const MAX_RETRY_ATTEMPTS = 3;
const IOS_REFRESH_DELAY = 500; // 500ms Verzögerung für iOS

export function useConnectionManager() {
    const { user } = useAuth();
    const [isOnline, setIsOnline] = useState(true);
    const [lastHeartbeat, setLastHeartbeat] = useState(Date.now());
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    // Refs für besseres State-Management
    const mountedRef = useRef(true);
    const lastRefreshRef = useRef(Date.now());
    const refreshInProgressRef = useRef(false);

    // iOS-Erkennung
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            setIsIOS(ios);
            setIsStandalone(window.navigator.standalone);
        }

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Verbesserte Heartbeat-Funktion mit iOS-Optimierungen
    const checkConnection = useCallback(async () => {
        if (!mountedRef.current || refreshInProgressRef.current) return;

        try {
            const start = Date.now();

            // Versuche zuerst eine einfache Authentifizierungsprüfung
            const { data: authData } = await supabase.auth.getSession();
            if (!authData?.session && user) {
                throw new Error('Session verloren');
            }

            // Dann prüfe die Datenbankverbindung
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .limit(1)
                .maybeSingle();

            if (!mountedRef.current) return;

            const end = Date.now();
            if (error) throw error;

            // Wenn die Antwort zu lange dauert, könnte die Verbindung instabil sein
            const responseTime = end - start;
            const maxResponseTime = isIOS ? 8000 : 5000; // Längerer Timeout für iOS
            if (responseTime > maxResponseTime) {
                console.warn('Langsame Verbindung:', responseTime, 'ms');
                if (retryCount < MAX_RETRY_ATTEMPTS) {
                    setRetryCount(prev => prev + 1);
                    setNeedsRefresh(true);
                    return;
                }
            }

            if (mountedRef.current) {
                setIsOnline(true);
                setLastHeartbeat(Date.now());
                setRetryCount(0);
            }
        } catch (error) {
            if (!mountedRef.current) return;

            console.error('Verbindungsfehler:', error);
            setIsOnline(false);
            setNeedsRefresh(true);

            // Bei Authentifizierungsfehlern
            if (error.message === 'Session verloren' || error.status === 401) {
                if (isIOS && isStandalone) {
                    // Für iOS-Lesezeichen: Versuche sanfte Aktualisierung
                    await refreshData(true);
                } else {
                    // Verhindere mehrfache Neuladezyklen
                    const now = Date.now();
                    if (now - lastRefreshRef.current > 5000) {
                        lastRefreshRef.current = now;
                        window.location.reload();
                    }
                }
                return;
            }
        }
    }, [user, retryCount, isIOS, isStandalone]);

    // Verbesserte Aktualisierungsfunktion mit iOS-Optimierungen
    const refreshData = useCallback(async (force = false) => {
        if (!user || !mountedRef.current || refreshInProgressRef.current) return;

        refreshInProgressRef.current = true;
        try {
            // Session aktualisieren
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;

            if (!session || force) {
                const { error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) throw refreshError;

                // Für iOS: Warte kurz nach Session-Aktualisierung
                if (isIOS) {
                    await new Promise(resolve => setTimeout(resolve, IOS_REFRESH_DELAY));
                }
            }

            if (!mountedRef.current) return;

            // Daten neu laden mit Retry-Logik
            let attempts = 0;
            while (attempts < MAX_RETRY_ATTEMPTS && mountedRef.current) {
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('id', user.id)
                        .single();

                    if (error) throw error;

                    if (mountedRef.current) {
                        setNeedsRefresh(false);
                    }
                    break;
                } catch (error) {
                    attempts++;
                    if (attempts === MAX_RETRY_ATTEMPTS) throw error;
                    // Längere Verzögerung für iOS
                    const delay = isIOS ? 2000 * attempts : 1000 * attempts;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        } catch (error) {
            if (!mountedRef.current) return;

            console.error('Fehler beim Aktualisieren:', error);
            if (error.status === 401 || error.message?.includes('session')) {
                if (isIOS && isStandalone) {
                    // Sanfte Aktualisierung für iOS-Lesezeichen
                    const now = Date.now();
                    if (now - lastRefreshRef.current > 5000) {
                        lastRefreshRef.current = now;
                        window.location.href = window.location.href;
                    }
                } else {
                    window.location.reload();
                }
            }
        } finally {
            if (mountedRef.current) {
                refreshInProgressRef.current = false;
            }
        }
    }, [user, isIOS, isStandalone]);

    // Verbessertes Intervall-Management mit iOS-Optimierungen
    useEffect(() => {
        let heartbeatInterval;
        let refreshInterval;

        const setupIntervals = () => {
            // Längeres Intervall für iOS im Standalone-Modus
            const heartbeatDelay = (isIOS && isStandalone) ? HEARTBEAT_INTERVAL * 2 : HEARTBEAT_INTERVAL;

            heartbeatInterval = setInterval(() => {
                if (mountedRef.current && !refreshInProgressRef.current) {
                    checkConnection();
                }
            }, heartbeatDelay);

            refreshInterval = setInterval(() => {
                if (!mountedRef.current || refreshInProgressRef.current) return;
                const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
                if (timeSinceLastHeartbeat > heartbeatDelay * 2) {
                    setNeedsRefresh(true);
                }
            }, REFRESH_INTERVAL);
        };

        if (typeof window !== 'undefined') {
            checkConnection();
            setupIntervals();

            const handleOnline = () => {
                if (!mountedRef.current) return;
                setIsOnline(true);
                // Verzögerte Verbindungsprüfung für iOS
                if (isIOS) {
                    setTimeout(checkConnection, IOS_REFRESH_DELAY);
                } else {
                    checkConnection();
                }
            };

            const handleOffline = () => {
                if (mountedRef.current) setIsOnline(false);
            };

            const handleVisibilityChange = () => {
                if (!mountedRef.current || refreshInProgressRef.current) return;
                if (document.visibilityState === 'visible') {
                    // Verzögerte Prüfung für iOS
                    if (isIOS) {
                        setTimeout(() => {
                            if (mountedRef.current) {
                                checkConnection();
                                if (needsRefresh) {
                                    refreshData();
                                }
                            }
                        }, IOS_REFRESH_DELAY);
                    } else {
                        checkConnection();
                        if (needsRefresh) {
                            refreshData();
                        }
                    }
                }
            };

            // iOS-spezifische Event-Listener
            const handlePageShow = (e) => {
                if (!mountedRef.current || !isIOS || refreshInProgressRef.current) return;

                // Wenn die Seite aus dem bfcache geladen wird
                if (e.persisted) {
                    setTimeout(() => {
                        if (mountedRef.current) {
                            checkConnection();
                            refreshData(true);
                        }
                    }, IOS_REFRESH_DELAY);
                }
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);
            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('focus', handleVisibilityChange);
            window.addEventListener('pageshow', handlePageShow);

            return () => {
                mountedRef.current = false;
                clearInterval(heartbeatInterval);
                clearInterval(refreshInterval);
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('focus', handleVisibilityChange);
                window.removeEventListener('pageshow', handlePageShow);
            };
        }
    }, [checkConnection, refreshData, lastHeartbeat, needsRefresh, isIOS, isStandalone]);

    // Automatische Aktualisierung mit iOS-Optimierungen
    useEffect(() => {
        let refreshTimeout;
        if (needsRefresh && isOnline && !refreshInProgressRef.current) {
            const delay = isIOS ? IOS_REFRESH_DELAY * 2 : 1000;
            refreshTimeout = setTimeout(() => {
                if (mountedRef.current) {
                    refreshData();
                }
            }, delay);
        }
        return () => {
            clearTimeout(refreshTimeout);
        };
    }, [needsRefresh, isOnline, refreshData, isIOS]);

    return {
        isOnline,
        needsRefresh,
        lastHeartbeat,
        refreshData,
        isIOS,
        isStandalone
    };
} 