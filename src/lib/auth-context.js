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

    // Versuche, den Cache zu nutzen, um Flackern zu reduzieren
    useEffect(() => {
        try {
            // Versuche, den Benutzer aus dem lokalen Speicher zu laden
            const cachedAuth = localStorage.getItem(AUTH_CACHE_KEY);
            if (cachedAuth) {
                const { user: cachedUser, isAdmin: cachedAdmin } = JSON.parse(cachedAuth);
                if (cachedUser) {
                    setUser(cachedUser);
                    setAdminStatus(cachedAdmin);
                }
            }
        } catch (e) {
            console.error('Fehler beim Lesen des Auth-Caches:', e);
        }
    }, []);

    useEffect(() => {
        // Beim Laden der Komponente den aktuellen Benutzer abrufen
        const getUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    setUser(session.user);

                    // Prüfen, ob der Benutzer Admin-Rechte hat
                    const admin = await isAdmin(session.user.id);
                    setAdminStatus(admin);

                    // Cache aktualisieren
                    try {
                        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                            user: session.user,
                            isAdmin: admin
                        }));
                    } catch (e) {
                        console.error('Fehler beim Speichern des Auth-Caches:', e);
                    }
                } else {
                    // Cache leeren, wenn kein Benutzer
                    try {
                        localStorage.removeItem(AUTH_CACHE_KEY);
                    } catch (e) {
                        console.error('Fehler beim Löschen des Auth-Caches:', e);
                    }
                }
            } catch (error) {
                console.error('Fehler beim Abrufen des Benutzers:', error);
            } finally {
                setLoading(false);
                setInitialized(true);
            }
        };

        getUser();

        // Auth-Status überwachen
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session?.user) {
                    setUser(session.user);

                    // Prüfen, ob der Benutzer Admin-Rechte hat
                    const admin = await isAdmin(session.user.id);
                    setAdminStatus(admin);

                    // Cache aktualisieren
                    try {
                        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                            user: session.user,
                            isAdmin: admin
                        }));
                    } catch (e) {
                        console.error('Fehler beim Speichern des Auth-Caches:', e);
                    }
                } else {
                    setUser(null);
                    setAdminStatus(false);

                    // Cache leeren
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
            subscription.unsubscribe();
        };
    }, []);

    // Memoisierte Werte, um unnötiges Re-Rendering zu vermeiden
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