"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase, checkConnection } from "@/lib/supabase-client";

// Metadata in Client-Komponenten wird nicht unterstützt
// und muss in einer separaten Datei definiert werden

export default function AchievementsLayout({ children }) {
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [session, setSession] = useState(null);
    const [lastReload, setLastReload] = useState(0); // Starte mit 0 statt Date.now()
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [connectionChecking, setConnectionChecking] = useState(false);

    // Initialisiere lastReload nur auf Client-Seite
    useEffect(() => {
        setLastReload(Date.now());
    }, []);

    // Session & User anzeigen
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            setSession(data?.session || null);
            setToken(data?.session?.access_token || null);
            setUser(data?.session?.user || null);
        });
        const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setToken(session?.access_token || null);
            setUser(session?.user || null);
        });
        return () => {
            listener?.subscription.unsubscribe();
        };
    }, []);

    // Verbindung prüfen
    const checkConnectionStatus = useCallback(async () => {
        try {
            if (connectionChecking) {
                return null; // Indiziert "noch prüfend"
            }

            setConnectionChecking(true);

            const isConnected = await checkConnection();

            return isConnected;
        } catch (err) {
            return false;
        } finally {
            setConnectionChecking(false);
        }
    }, [connectionChecking]);

    // Daten laden mit Logging
    const fetchPlayers = useCallback(async () => {
        if (!lastReload) return; // Nicht ausführen, wenn lastReload noch nicht initialisiert ist

        setLoading(true);
        setError(null);

        try {
            // Verbindungsstatus prüfen ohne UI-Aktualisierung
            const isConnected = await checkConnection();
            if (!isConnected) {
                setError("Keine Verbindung zur Datenbank.");
                setLoading(false);
                return;
            }

            const { data, error } = await supabase.from("players").select("*");

            if (error) throw error;
            setPlayers(data || []);
        } catch (err) {
            setError(err.message || JSON.stringify(err));
            setPlayers([]);
        } finally {
            setLoading(false);
        }
    }, [lastReload]);

    // Initial + bei Reload
    useEffect(() => {
        if (lastReload > 0) {
            fetchPlayers();
        }
    }, [fetchPlayers, lastReload]);

    // Refetch bei Tab-Fokus mit Verbindungsprüfung
    useEffect(() => {
        async function onFocus() {
            const isConnected = await checkConnectionStatus();

            // Null bedeutet "Prüfung läuft noch" - nichts tun
            if (isConnected === null) return;

            if (isConnected) {
                setLastReload(Date.now());
            } else {
                // Verzögerter Reconnect-Versuch
                setTimeout(async () => {
                    const reconnected = await checkConnectionStatus();
                    if (reconnected === true) { // Expliziter Vergleich, da null auch falsy ist
                        setLastReload(Date.now());
                    }
                }, 2000);
            }
        }
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [checkConnectionStatus]);

    return children;
} 