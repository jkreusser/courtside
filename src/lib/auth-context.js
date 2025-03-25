'use client';

import { createContext, useState, useEffect, useContext, useMemo, useRef, useCallback } from 'react';
import { supabase, isAdmin, reconnectSupabase } from './supabase';
import { useRouter } from 'next/navigation';
import { eventBus, EVENTS } from './eventBus';

// Auth Context erstellen
const AuthContext = createContext();

// Schlüssel für clientseitiges Caching
const AUTH_CACHE_KEY = 'courtside_auth_cache';

// Verbesserte Statusverwaltung
const CONNECTION_STATES = {
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    ERROR: 'error'
};

// Konstanten für die Verbindungsverwaltung
const HEARTBEAT_INTERVAL = 30000; // 30 Sekunden
const REFRESH_INTERVAL = 60000; // 1 Minute
const MAX_RETRY_ATTEMPTS = 3;
const IOS_REFRESH_DELAY = 500; // 500ms Verzögerung für iOS

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();
    const [adminStatus, setAdminStatus] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [connectionState, setConnectionState] = useState(CONNECTION_STATES.CONNECTING);
    const mountedRef = useRef(true);
    const authSubscriptionRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const lastActiveTimestampRef = useRef(Date.now());
    const refreshInProgressRef = useRef(false);

    // Verbindungsmanagement-States
    const [isOnline, setIsOnline] = useState(true);
    const [needsRefresh, setNeedsRefresh] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const lastRefreshRef = useRef(Date.now());

    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 Minuten

    // Verbesserte Verbindungsprüfung mit Retry-Logik
    const checkConnection = useCallback(async (force = false) => {
        if (!mountedRef.current || (refreshInProgressRef.current && !force)) return;

        try {
            refreshInProgressRef.current = true;
            setConnectionState(CONNECTION_STATES.CONNECTING);

            // 1. Prüfe die aktuelle Session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;

            // 2. Wenn keine Session, setze User auf null
            if (!session?.user) {
                if (mountedRef.current) {
                    setUser(null);
                    setConnectionState(CONNECTION_STATES.DISCONNECTED);
                    setLoading(false);
                }
                return;
            }

            // 3. Versuche die Session zu aktualisieren
            const { error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) throw refreshError;

            // 4. Prüfe die Datenbankverbindung mit Retry
            let retryCount = 0;
            let dbError = null;

            while (retryCount < MAX_RETRIES) {
                try {
                    const { error: testError } = await supabase
                        .from('profiles')
                        .select('count')
                        .limit(1)
                        .single();

                    if (!testError) {
                        dbError = null;
                        break;
                    }
                    dbError = testError;
                } catch (error) {
                    dbError = error;
                }

                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
                }
            }

            if (dbError) throw dbError;

            // 5. Lade die Benutzerdaten neu
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (userError) throw userError;

            // 6. Prüfe Admin-Status
            const isAdminUser = await isAdmin(session.user.id);

            // 7. Aktualisiere den User-Status
            if (mountedRef.current) {
                setUser(session.user);
                setAdminStatus(isAdminUser);
                setConnectionState(CONNECTION_STATES.CONNECTED);
                setLoading(false);
                setError(null);
                setIsOnline(true);
            }
        } catch (error) {
            console.error('Verbindungsfehler:', error);
            if (mountedRef.current) {
                setConnectionState(CONNECTION_STATES.DISCONNECTED);
                setError(error);
                setLoading(false);
                setIsOnline(false);
            }
        } finally {
            refreshInProgressRef.current = false;
        }
    }, []);

    // Verbesserte Visibility Change Handler
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleVisibilityChange = async () => {
            if (!mountedRef.current) return;

            if (document.visibilityState === 'visible') {
                try {
                    // Verzögerung für iOS
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Force Reconnect und Daten neu laden
                    await checkConnection(true);

                    // Aktualisiere den Zeitstempel
                    lastActiveTimestampRef.current = Date.now();

                    // Setze den Verbindungsstatus explizit
                    setConnectionState(CONNECTION_STATES.CONNECTED);
                    setIsOnline(true);

                    // Trigger Event für Datenaktualisierung
                    eventBus.emit(EVENTS.DATA_REFRESH);
                } catch (error) {
                    console.error('Fehler bei der Wiederverbindung:', error);
                    setConnectionState(CONNECTION_STATES.DISCONNECTED);
                    setIsOnline(false);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleVisibilityChange);
        };
    }, [checkConnection]);

    // Initiale Auth-Initialisierung
    useEffect(() => {
        const initializeAuth = async () => {
            if (!mountedRef.current) return;

            try {
                setLoading(true);
                setConnectionState(CONNECTION_STATES.CONNECTING);

                // 1. Hole die aktuelle Session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;

                // 2. Wenn keine Session, setze User auf null
                if (!session?.user) {
                    if (mountedRef.current) {
                        setUser(null);
                        setConnectionState(CONNECTION_STATES.DISCONNECTED);
                        setLoading(false);
                    }
                    return;
                }

                // 3. Prüfe die Datenbankverbindung
                const { error: dbError } = await supabase
                    .from('profiles')
                    .select('count')
                    .limit(1)
                    .single();

                if (dbError) throw dbError;

                // 4. Setze den User-Status
                if (mountedRef.current) {
                    setUser(session.user);
                    setConnectionState(CONNECTION_STATES.CONNECTED);
                    setLoading(false);
                    setError(null);
                }
            } catch (error) {
                console.error('Fehler bei der Auth-Initialisierung:', error);
                if (mountedRef.current) {
                    setError(error);
                    setConnectionState(CONNECTION_STATES.ERROR);
                    setLoading(false);
                }
            } finally {
                if (mountedRef.current) {
                    setInitialized(true);
                }
            }

            // Auth State Change Listener
            const { data: { subscription } } = await supabase.auth.onAuthStateChange(async (event, session) => {
                if (!mountedRef.current) return;

                try {
                    if (session?.user) {
                        const { error: dbError } = await supabase
                            .from('profiles')
                            .select('count')
                            .limit(1)
                            .single();

                        if (dbError) throw dbError;

                        if (mountedRef.current) {
                            setUser(session.user);
                            setConnectionState(CONNECTION_STATES.CONNECTED);
                            setError(null);
                        }
                    } else {
                        if (mountedRef.current) {
                            setUser(null);
                            setConnectionState(CONNECTION_STATES.DISCONNECTED);
                        }
                    }
                } catch (error) {
                    console.error('Fehler bei Auth State Change:', error);
                    if (mountedRef.current) {
                        setError(error);
                        setConnectionState(CONNECTION_STATES.ERROR);
                    }
                }
            });

            authSubscriptionRef.current = subscription;
        };

        initializeAuth();

        return () => {
            mountedRef.current = false;
            if (authSubscriptionRef.current) {
                authSubscriptionRef.current.unsubscribe();
            }
        };
    }, []);

    // iOS-Erkennung
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            setIsIOS(ios);
            setIsStandalone(window.navigator.standalone);
        }
    }, []);

    // Verbesserte Verbindungsüberwachung
    useEffect(() => {
        let heartbeatInterval;
        let refreshInterval;

        const setupIntervals = () => {
            const heartbeatDelay = (isIOS && isStandalone) ? HEARTBEAT_INTERVAL * 2 : HEARTBEAT_INTERVAL;

            heartbeatInterval = setInterval(() => {
                if (mountedRef.current && !refreshInProgressRef.current) {
                    checkConnection(true);
                    lastActiveTimestampRef.current = Date.now();
                }
            }, heartbeatDelay);

            refreshInterval = setInterval(() => {
                if (mountedRef.current && !refreshInProgressRef.current) {
                    const timeSinceLastHeartbeat = Date.now() - lastActiveTimestampRef.current;
                    if (timeSinceLastHeartbeat > heartbeatDelay * 2) {
                        setNeedsRefresh(true);
                        checkConnection(true);
                    }
                }
            }, REFRESH_INTERVAL);
        };

        if (typeof window !== 'undefined') {
            setupIntervals();

            const handleOnline = () => {
                if (!mountedRef.current) return;
                setIsOnline(true);
                checkConnection(true);
            };

            const handleOffline = () => {
                if (mountedRef.current) {
                    setIsOnline(false);
                    setConnectionState(CONNECTION_STATES.DISCONNECTED);
                }
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                clearInterval(heartbeatInterval);
                clearInterval(refreshInterval);
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        }
    }, [checkConnection, isIOS, isStandalone]);

    const value = useMemo(() => ({
        user,
        loading,
        isAdmin: adminStatus,
        initialized,
        connectionState,
        error,
        isOnline,
        needsRefresh,
        refreshData: checkConnection
    }), [user, loading, adminStatus, initialized, connectionState, error, isOnline, needsRefresh, checkConnection]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

// Hook für den einfachen Zugriff auf den Auth-Context
export function useAuth() {
    return useContext(AuthContext);
} 