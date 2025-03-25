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

            // Versuche die Session zu aktualisieren
            const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError) {
                console.warn('Session-Aktualisierung fehlgeschlagen:', refreshError);
                // Versuche trotzdem fortzufahren
            }

            const admin = await isAdmin(session.user.id);
            setUser(refreshedSession?.session?.user || session.user);
            setAdminStatus(admin);
            setRetryCount(0);
            setLastActiveTimestamp(Date.now());

            try {
                localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                    user: refreshedSession?.session?.user || session.user,
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

    // Verbesserte Session-Wiederherstellung
    useEffect(() => {
        let mounted = true;
        let sessionCheckInterval;

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

        // Regelmäßige Session-Überprüfung
        if (typeof window !== 'undefined') {
            sessionCheckInterval = setInterval(() => {
                const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                const isIOSHomeScreen = window.navigator.standalone;

                if (isPWA || isIOSHomeScreen) {
                    supabase.auth.getSession().then(({ data: { session } }) => {
                        if (session?.user) {
                            fetchUserWithRetry(session, true);
                        }
                    });
                }
            }, 60000); // Alle 60 Sekunden
        }

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
            if (sessionCheckInterval) {
                clearInterval(sessionCheckInterval);
            }
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