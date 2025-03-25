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

    // Verbesserte Cache-Initialisierung
    useEffect(() => {
        try {
            const cachedAuth = localStorage.getItem(AUTH_CACHE_KEY);
            if (cachedAuth) {
                const { user: cachedUser, timestamp } = JSON.parse(cachedAuth);
                if (Date.now() - timestamp < SESSION_TIMEOUT) {
                    setUser(cachedUser);
                }
            }
        } catch (e) {
            console.error('Fehler beim Laden des Auth-Caches:', e);
        }
    }, []);

    // Verbesserte Benutzerabfrage mit Retry-Logik
    const fetchUserWithRetry = async (session, force = false) => {
        if (!session?.user?.id) return null;

        try {
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (userError) {
                throw userError;
            }

            // Prüfe Admin-Status
            const isAdminUser = await isAdmin(session.user.id);
            setAdminStatus(isAdminUser);

            // Aktualisiere Cache
            try {
                localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                    user: session.user,
                    timestamp: Date.now()
                }));
            } catch (e) {
                console.error('Fehler beim Speichern des Auth-Caches:', e);
            }

            setUser(session.user);
            setLastActiveTimestamp(Date.now());
            return session.user;
        } catch (error) {
            console.error('Fehler beim Laden des Benutzerprofils:', error);

            if (retryCount < MAX_RETRIES) {
                setRetryCount(prev => prev + 1);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, retryCount)));
                return fetchUserWithRetry(session, force);
            }

            return null;
        }
    };

    // Verbesserte Session-Überwachung
    useEffect(() => {
        let mounted = true;
        let sessionCheckInterval;

        // Initialisiere die Auth-Überwachung
        const initializeAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();

                if (error) throw error;

                if (session?.user) {
                    await fetchUserWithRetry(session);
                }

                if (mounted) {
                    setLoading(false);
                    setInitialized(true);
                }
            } catch (error) {
                console.error('Fehler bei der Auth-Initialisierung:', error);
                if (mounted) {
                    setLoading(false);
                    setInitialized(true);
                }
            }
        };

        initializeAuth();

        // Session-Überprüfungsintervall
        sessionCheckInterval = setInterval(() => {
            const now = Date.now();
            if (now - lastActiveTimestamp > SESSION_TIMEOUT) {
                supabase.auth.refreshSession();
            }
        }, 60000); // Prüfe jede Minute

        // Auth-Statusänderungen überwachen
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (!mounted) return;

                console.log('Auth-Event:', event);

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

                if (mounted) {
                    setLoading(false);
                    setInitialized(true);
                }
            }
        );

        // Aktivitätsüberwachung
        const handleActivity = () => {
            setLastActiveTimestamp(Date.now());
        };

        window.addEventListener('mousemove', handleActivity);
        window.addEventListener('keydown', handleActivity);
        window.addEventListener('touchstart', handleActivity);

        return () => {
            mounted = false;
            subscription.unsubscribe();
            clearInterval(sessionCheckInterval);
            window.removeEventListener('mousemove', handleActivity);
            window.removeEventListener('keydown', handleActivity);
            window.removeEventListener('touchstart', handleActivity);
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