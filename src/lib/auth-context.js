'use client';

import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { supabase, isAdmin } from './supabase';

// Auth Context erstellen
const AuthContext = createContext();

// Schlüssel für clientseitiges Caching
const AUTH_CACHE_KEY = 'courtside_auth_cache';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adminStatus, setAdminStatus] = useState(false);
    const [initialized, setInitialized] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [lastActiveTimestamp, setLastActiveTimestamp] = useState(Date.now());
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 Minuten

    // Verbesserte Cache-Initialisierung mit iOS-Lesezeichen-Erkennung
    useEffect(() => {
        const isPWA = window.matchMedia('(display-mode: standalone)').matches;
        const isIOSHomeScreen = window.navigator.standalone;

        try {
            const cachedAuth = localStorage.getItem(AUTH_CACHE_KEY);
            if (cachedAuth) {
                const { user: cachedUser, isAdmin: cachedAdmin, timestamp } = JSON.parse(cachedAuth);
                // Längere Cache-Dauer für PWA/iOS-Lesezeichen
                const maxAge = (isPWA || isIOSHomeScreen) ? 12 * 3600000 : 3600000; // 12 Stunden für PWA
                if (cachedUser && Date.now() - timestamp < maxAge) {
                    setUser(cachedUser);
                    setAdminStatus(cachedAdmin);
                    // Aktualisiere im Hintergrund
                    setTimeout(() => {
                        supabase.auth.getSession().then(({ data: { session } }) => {
                            if (session?.user) {
                                fetchUserWithRetry(session, true);
                            }
                        });
                    }, 0);
                } else {
                    localStorage.removeItem(AUTH_CACHE_KEY);
                }
            }
        } catch (e) {
            console.error('Fehler beim Lesen des Auth-Caches:', e);
            localStorage.removeItem(AUTH_CACHE_KEY);
        }
    }, []);

    // Verbesserte Benutzerabruf-Funktion mit iOS-Optimierung
    const fetchUserWithRetry = async (session, force = false) => {
        try {
            const isPWA = window.matchMedia('(display-mode: standalone)').matches;
            const isIOSHomeScreen = window.navigator.standalone;

            // Wenn nicht erzwungen und der Benutzer bereits geladen ist
            if (!force && user && user.id === session.user.id) {
                // Prüfe auf Session-Timeout nur für PWA/iOS
                if (isPWA || isIOSHomeScreen) {
                    const timeSinceLastActive = Date.now() - lastActiveTimestamp;
                    if (timeSinceLastActive < SESSION_TIMEOUT) {
                        return true;
                    }
                } else {
                    return true;
                }
            }

            const admin = await isAdmin(session.user.id);
            setUser(session.user);
            setAdminStatus(admin);
            setRetryCount(0);
            setLastActiveTimestamp(Date.now());

            try {
                localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                    user: session.user,
                    isAdmin: admin,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error('Fehler beim Speichern des Auth-Caches:', e);
            }
            return true;
        } catch (error) {
            console.error('Fehler beim Abrufen des Benutzerstatus:', error);
            if (retryCount < MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
                return fetchUserWithRetry(session, force);
            }
            return false;
        }
    };

    // Verbesserter Visibility Change Handler für iOS
    useEffect(() => {
        if (typeof document === 'undefined') return;

        let reactivationTimeout;
        let lastHiddenTime = 0;

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenTime = Date.now();
            } else if (document.visibilityState === 'visible') {
                // Prüfe, ob die App länger als 5 Sekunden im Hintergrund war
                const hiddenDuration = Date.now() - lastHiddenTime;
                if (hiddenDuration > 5000) { // 5 Sekunden
                    try {
                        // Verzögere die Session-Überprüfung leicht für iOS
                        clearTimeout(reactivationTimeout);
                        reactivationTimeout = setTimeout(async () => {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user) {
                                await fetchUserWithRetry(session, true);
                            }
                        }, 100);
                    } catch (error) {
                        console.error('Fehler beim Wiederherstellen der Session:', error);
                    }
                }
            }
        };

        // Aktivitäts-Tracking für PWA/iOS
        const handleUserActivity = () => {
            setLastActiveTimestamp(Date.now());
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        // Tracke Benutzeraktivität
        document.addEventListener('touchstart', handleUserActivity);
        document.addEventListener('mousemove', handleUserActivity);
        document.addEventListener('keypress', handleUserActivity);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('touchstart', handleUserActivity);
            document.removeEventListener('mousemove', handleUserActivity);
            document.removeEventListener('keypress', handleUserActivity);
            clearTimeout(reactivationTimeout);
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        const getUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user && mounted) {
                    await fetchUserWithRetry(session);
                } else if (mounted) {
                    try {
                        localStorage.removeItem(AUTH_CACHE_KEY);
                    } catch (e) {
                        console.error('Fehler beim Löschen des Auth-Caches:', e);
                    }
                }
            } catch (error) {
                console.error('Fehler beim Abrufen des Benutzers:', error);
            } finally {
                if (mounted) {
                    setLoading(false);
                    setInitialized(true);
                }
            }
        };

        getUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                if (session?.user) {
                    await fetchUserWithRetry(session);
                } else {
                    setUser(null);
                    setAdminStatus(false);
                    try {
                        localStorage.removeItem(AUTH_CACHE_KEY);
                    } catch (e) {
                        console.error('Fehler beim Löschen des Auth-Caches:', e);
                    }
                }
                setLoading(false);
                setInitialized(true);
            }
        );

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [retryCount]);

    const value = useMemo(() => ({
        user,
        loading,
        isAdmin: adminStatus,
        initialized
    }), [user, loading, adminStatus, initialized]);

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