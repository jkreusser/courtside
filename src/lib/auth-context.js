'use client';

import { createContext, useState, useEffect, useContext } from 'react';
import { supabase, isAdmin } from './supabase';

// Auth Context erstellen
const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adminStatus, setAdminStatus] = useState(false);

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
                }
            } catch (error) {
                console.error('Fehler beim Abrufen des Benutzers:', error);
            } finally {
                setLoading(false);
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
                } else {
                    setUser(null);
                    setAdminStatus(false);
                }
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin: adminStatus }}>
            {children}
        </AuthContext.Provider>
    );
}

// Hook für den einfachen Zugriff auf den Auth-Context
export function useAuth() {
    return useContext(AuthContext);
} 