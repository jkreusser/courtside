'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, getCurrentUser, signOut as supabaseSignOut, checkConnection } from './supabase-client';
import { useRouter } from 'next/navigation';
// Entferne den Tab-Visibility-Import
// import { useTabVisibility } from './tab-visibility-helper';

// Erstelle den Auth-Kontext
const AuthContext = createContext({
    user: null,
    session: null,
    loading: true,
    connectionStatus: 'loading', // 'loading', 'connected', 'disconnected'
    signOut: async () => { },
    checkConnection: async () => false,
    attemptReconnect: async () => false
});

// Hook für den Zugriff auf den Auth-Kontext
export const useAuth = () => useContext(AuthContext);

// ⚠️ Deaktiviere KOMPLETT alle automatischen Navigationen
const DISABLE_AUTO_NAVIGATION = true;

// Provider-Komponente
export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [connectionStatus, setConnectionStatus] = useState('loading');
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const router = useRouter();
    const [initialAuthComplete, setInitialAuthComplete] = useState(false);
    const [lastAuthEvent, setLastAuthEvent] = useState(null);

    // Sichere Navigation Funktion
    const safeNavigate = useCallback((path) => {
        if (DISABLE_AUTO_NAVIGATION) {
            console.warn(`[Auth] ⛔ Automatische Navigation zu "${path}" ist deaktiviert!`);
            return;
        }

        console.log(`[Auth] Navigation zu: ${path}`);
        router.push(path);
    }, [router]);

    // Verbindungsstatus prüfen
    const checkConnectionStatus = useCallback(async (force = false) => {
        try {
            console.log('[Auth] Überprüfe Verbindungsstatus...');
            const isConnected = await checkConnection();
            console.log('[Auth] Verbindungsstatus:', isConnected ? 'verbunden' : 'getrennt');
            setConnectionStatus(isConnected ? 'connected' : 'disconnected');
            return isConnected;
        } catch (err) {
            console.error('[Auth] Verbindungsfehler:', err);
            setConnectionStatus('disconnected');
            return false;
        }
    }, []);

    // Wiederverbindungsversuch
    const attemptReconnect = useCallback(async () => {
        if (reconnectAttempts > 5) {
            console.warn('[Auth] Maximale Anzahl an Wiederverbindungsversuchen erreicht');
            return false;
        }

        setReconnectAttempts(prev => prev + 1);
        setConnectionStatus('loading');

        // Kurze Pause vor Wiederverbindung
        await new Promise(r => setTimeout(r, 1000));

        const isConnected = await checkConnectionStatus(true);

        if (isConnected) {
            // Bei erfolgreicher Verbindung den Zähler zurücksetzen
            setReconnectAttempts(0);
            return true;
        } else {
            console.warn(`[Auth] Wiederverbindungsversuch ${reconnectAttempts + 1}/6 fehlgeschlagen`);
            return false;
        }
    }, [reconnectAttempts, checkConnectionStatus]);

    // Session laden beim Initialisieren
    useEffect(() => {
        let mounted = true;
        console.log('[Auth] 🚀 Initialisiere Auth Provider');

        const initializeAuth = async () => {
            try {
                // Session abrufen
                const { data: { session: currentSession } } = await supabase.auth.getSession();
                console.log('[Auth] Session geladen', currentSession ? 'mit Benutzer' : 'ohne Benutzer');

                if (mounted) {
                    setSession(currentSession);
                    setUser(currentSession?.user || null);
                    setLoading(false);
                    setInitialAuthComplete(true);

                    // Überprüfe die Verbindung nach dem Laden der Session
                    checkConnectionStatus();
                }
            } catch (error) {
                console.error('[Auth] Fehler beim Initialisieren der Session:', error);
                if (mounted) {
                    setLoading(false);
                    setConnectionStatus('disconnected');
                    setInitialAuthComplete(true);
                }
            }
        };

        initializeAuth();

        // Tab-Visibility-Ereignisse überwachen
        const handleVisibilityChange = () => {
            const isVisible = document.visibilityState === 'visible';
            console.log(`[Auth] Tab-Visibility-Änderung: ${isVisible ? 'sichtbar' : 'versteckt'}`);
            console.log(`[Auth] Aktueller Pfad bei Tab-Wechsel: ${window.location.pathname}`);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Auth-Status-Änderungen überwachen
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (mounted) {
                console.log('[Auth] 🔑 Auth-Event:', event);
                setLastAuthEvent(event);
                setSession(currentSession);
                setUser(currentSession?.user || null);
                setLoading(false);

                // NUR Logging, aber KEINE Navigation
                if (event === 'SIGNED_OUT') {
                    console.log('[Auth] Abmeldung erkannt, Navigation deaktiviert');
                    // DEAKTIVIERT: safeNavigate('/login');
                } else if (event === 'SIGNED_IN') {
                    console.log('[Auth] Anmeldung erkannt, Navigation deaktiviert');
                    // DEAKTIVIERT: safeNavigate('/');
                } else {
                    console.log('[Auth] Event ohne Navigation:', event);
                }
            }
        });

        // Cleanup
        return () => {
            console.log('[Auth] Cleanup Auth Provider');
            mounted = false;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            authListener?.subscription.unsubscribe();
        };
    }, [checkConnectionStatus, safeNavigate]);

    // Abmelden
    const signOut = useCallback(async () => {
        setLoading(true);
        const { error } = await supabaseSignOut();

        if (error) {
            console.error('[Auth] Fehler beim Abmelden:', error);
        }

        setLoading(false);
        return { error };
    }, []);

    // Eine einfache, regelmäßige Verbindungsprüfung alle 60 Sekunden
    useEffect(() => {
        // Prüfe die Verbindung alle 60 Sekunden 
        console.log('[Auth] Starte regelmäßige Verbindungsprüfung');
        const interval = setInterval(() => checkConnectionStatus(), 60000);

        return () => {
            console.log('[Auth] Stoppe regelmäßige Verbindungsprüfung');
            if (interval) clearInterval(interval);
        };
    }, [checkConnectionStatus]);

    // Kontext-Werte
    const value = {
        user,
        session,
        loading,
        connectionStatus,
        setConnectionStatus,
        signOut,
        checkConnection: checkConnectionStatus,
        attemptReconnect,
        lastAuthEvent // Debugging Hilfsvariable
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
} 