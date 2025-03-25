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
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    // Verbesserte Cache-Initialisierung
    useEffect(() => {
        try {
            const cachedAuth = localStorage.getItem(AUTH_CACHE_KEY);
            if (cachedAuth) {
                const { user: cachedUser, isAdmin: cachedAdmin, timestamp } = JSON.parse(cachedAuth);
                // Prüfe ob der Cache nicht älter als 1 Stunde ist
                if (cachedUser && Date.now() - timestamp < 3600000) {
                    setUser(cachedUser);
                    setAdminStatus(cachedAdmin);
                } else {
                    localStorage.removeItem(AUTH_CACHE_KEY);
                }
            }
        } catch (e) {
            console.error('Fehler beim Lesen des Auth-Caches:', e);
            localStorage.removeItem(AUTH_CACHE_KEY);
        }
    }, []);

    // Verbesserte Benutzerabruf-Funktion mit Retry-Logik
    const fetchUserWithRetry = async (session) => {
        try {
            const admin = await isAdmin(session.user.id);
            setUser(session.user);
            setAdminStatus(admin);
            setRetryCount(0);

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
                return fetchUserWithRetry(session);
            }
            return false;
        }
    };

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