import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Verbesserte Supabase-Client-Konfiguration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'courtside_auth_storage',
        storage: {
            getItem: (key) => {
                try {
                    const value = localStorage.getItem(key);
                    if (!value) return null;

                    const isPWA = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
                    const isIOSHomeScreen = typeof window !== 'undefined' && window.navigator.standalone;

                    // Versuche die Session wiederherzustellen
                    const session = JSON.parse(value);

                    // Längere Session-Gültigkeit für PWA/iOS
                    if ((isPWA || isIOSHomeScreen) && session?.expires_at) {
                        // Verlängere die Ablaufzeit für PWA/iOS
                        const extendedExpiresAt = new Date(session.expires_at * 1000);
                        extendedExpiresAt.setHours(extendedExpiresAt.getHours() + 12);
                        session.expires_at = Math.floor(extendedExpiresAt.getTime() / 1000);

                        // Speichere die verlängerte Session
                        try {
                            localStorage.setItem(key, JSON.stringify(session));
                        } catch (e) {
                            console.error('Fehler beim Speichern der verlängerten Session:', e);
                        }
                    }

                    // Prüfe Session-Gültigkeit
                    if (session?.expires_at && new Date(session.expires_at * 1000) < new Date()) {
                        localStorage.removeItem(key);
                        return null;
                    }

                    return JSON.stringify(session);
                } catch (error) {
                    console.error('Fehler beim Lesen der Session:', error);
                    return null;
                }
            },
            setItem: (key, value) => {
                try {
                    const isPWA = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
                    const isIOSHomeScreen = typeof window !== 'undefined' && window.navigator.standalone;

                    if (isPWA || isIOSHomeScreen) {
                        // Verlängere die Session-Dauer für PWA/iOS
                        const session = JSON.parse(value);
                        if (session?.expires_at) {
                            const extendedExpiresAt = new Date(session.expires_at * 1000);
                            extendedExpiresAt.setHours(extendedExpiresAt.getHours() + 12);
                            session.expires_at = Math.floor(extendedExpiresAt.getTime() / 1000);
                            localStorage.setItem(key, JSON.stringify(session));
                        } else {
                            localStorage.setItem(key, value);
                        }
                    } else {
                        localStorage.setItem(key, value);
                    }
                } catch (error) {
                    console.error('Fehler beim Speichern der Session:', error);
                }
            },
            removeItem: (key) => {
                try {
                    localStorage.removeItem(key);
                } catch (error) {
                    console.error('Fehler beim Entfernen der Session:', error);
                }
            }
        }
    },
    realtime: {
        params: {
            eventsPerSecond: 2
        }
    },
    db: {
        schema: 'public'
    },
    global: {
        headers: {
            'x-application-name': 'courtside-pwa'
        },
        // Erhöhe Timeouts für instabile Verbindungen
        fetchOptions: {
            timeout: 30000 // 30 Sekunden für bessere iOS-Unterstützung
        }
    }
});

// Für Admin-Operationen die RLS umgehen
export const supabaseAdmin = typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    : supabase; // Im Browser oder wenn der Service Role Key nicht verfügbar ist, falle auf normale Rechte zurück

// Verbesserte Cache-Konfiguration
const CACHE_CONFIG = {
    DEFAULT_DURATION: 5 * 60 * 1000, // 5 Minuten
    EXTENDED_DURATION: 30 * 60 * 1000, // 30 Minuten für PWA
    STALE_WHILE_REVALIDATE: 60 * 60 * 1000, // 1 Stunde
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000,
    TIMEOUT: 10000 // 10 Sekunden
};

// Verbesserte Cache-Struktur
const cache = {
    profiles: new Map(),
    rankings: new Map(),
    players: new Map(),
    timestamp: new Map(),
    version: 0
};

// Hilfsfunktion für Cache-Management
const cacheManager = {
    get: (key, userId = null) => {
        const cacheKey = userId ? `${key}_${userId}` : key;
        const data = cache[key].get(cacheKey);
        const timestamp = cache.timestamp.get(cacheKey);

        if (!data || !timestamp) return null;

        const isPWA = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
        const maxAge = isPWA ? CACHE_CONFIG.EXTENDED_DURATION : CACHE_CONFIG.DEFAULT_DURATION;

        if (Date.now() - timestamp < maxAge) {
            return { data, fresh: true };
        }

        if (Date.now() - timestamp < CACHE_CONFIG.STALE_WHILE_REVALIDATE) {
            return { data, fresh: false };
        }

        return null;
    },

    set: (key, data, userId = null) => {
        const cacheKey = userId ? `${key}_${userId}` : key;
        cache[key].set(cacheKey, data);
        cache.timestamp.set(cacheKey, Date.now());
        cache.version++;
    },

    clear: (key = null) => {
        if (key) {
            cache[key].clear();
            cache.version++;
        } else {
            Object.keys(cache).forEach(k => {
                if (k !== 'version') cache[k].clear();
            });
            cache.version++;
        }
    }
};

// Funktion zum Anmelden mit Magic Link
export async function signInWithMagicLink(email) {
    try {
        // Bestimme die Redirect-URL: in der Browser-Umgebung nutze window.location.origin, sonst die Fallback-URL
        const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : `${siteUrl}/auth/callback`;

        const { data, error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: redirectTo,
            },
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

// Funktion zum Anmelden mit Zugangscode
export async function signInWithAccessCode(email, accessCode) {
    try {
        console.log("Starte Anmeldeprozess...");

        // Prüfe den globalen Zugangscode
        const globalAccessCode = process.env.NEXT_PUBLIC_GLOBAL_ACCESS_CODE;

        if (!globalAccessCode) {
            console.error("Globaler Zugangscode ist nicht konfiguriert");
            return {
                data: null,
                error: { message: 'Zugangscode-Konfiguration fehlt' }
            };
        }

        if (accessCode !== globalAccessCode) {
            console.error("Falscher Zugangscode eingegeben");
            return {
                data: null,
                error: { message: 'Zugangscode ist nicht korrekt' }
            };
        }

        // Versuche den Benutzer anzumelden
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: accessCode
        });

        if (authError) {
            console.error("Auth-Fehler:", authError);

            // Spezifische Fehlerbehandlung
            if (authError.message?.includes('Invalid login credentials') ||
                authError.message?.includes('User not found')) {
                return {
                    data: null,
                    error: {
                        message: 'Benutzer nicht gefunden',
                        status: 404,
                        name: 'UserNotFound'
                    }
                };
            }

            return {
                data: null,
                error: {
                    message: authError.message || 'Anmeldung fehlgeschlagen',
                    status: authError.status,
                    name: authError.name
                }
            };
        }

        if (!authData?.user) {
            return {
                data: null,
                error: { message: 'Keine Benutzerdaten erhalten' }
            };
        }

        // Erfolgreiche Anmeldung
        console.log("Anmeldung erfolgreich:", authData.user.id);
        return {
            data: authData,
            error: null
        };

    } catch (error) {
        console.error("Unerwarteter Fehler bei der Anmeldung:", error);
        return {
            data: null,
            error: {
                message: 'Ein unerwarteter Fehler ist aufgetreten',
                originalError: error
            }
        };
    }
}

// Funktion zum Erstellen eines neuen Benutzers mit Zugangscode
export async function createUserWithAccessCode(email, name, accessCode, role = 'player') {
    try {
        console.log("Versuche Benutzer zu erstellen:", { email, name, role });

        // Prüfe zuerst, ob der Zugangscode korrekt ist
        const globalAccessCode = process.env.NEXT_PUBLIC_GLOBAL_ACCESS_CODE;

        if (!globalAccessCode) {
            console.error("Globaler Zugangscode ist nicht konfiguriert");
            return {
                data: null,
                error: { message: 'Zugangscode-Konfiguration fehlt' }
            };
        }

        // Wenn der eingegebene Code nicht mit dem globalen Code übereinstimmt, gib einen Fehler zurück
        console.log("Prüfe Zugangscode...");
        if (accessCode !== globalAccessCode) {
            console.error("Falscher Zugangscode eingegeben beim Erstellen eines Benutzers:", accessCode);
            return {
                data: null,
                error: { message: 'Der Zugangscode ist nicht korrekt.' }
            };
        }

        // Prüfe, ob ein Benutzer mit dieser E-Mail bereits existiert
        console.log("Prüfe, ob Benutzer bereits existiert...");
        const { data: existingUser, error: checkError } = await supabase.auth.signInWithPassword({
            email,
            password: accessCode,
        });

        if (checkError) {
            console.log("Benutzer existiert noch nicht (erwartet):", JSON.stringify(checkError));
        }

        if (existingUser && existingUser.user) {
            console.error("Benutzer existiert bereits:", existingUser.user.id);
            return {
                data: null,
                error: { message: 'User already registered' }
            };
        }

        // Erstelle einen neuen Benutzer mit dem Zugangscode als Passwort
        // Wichtig: emailConfirm: false aktiviert - dadurch wird keine E-Mail-Bestätigung verlangt
        console.log("Erstelle neuen Benutzer...");
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password: accessCode,
            options: {
                data: {
                    name,
                    role
                },
                emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
                emailConfirm: false // Deaktiviert die E-Mail-Bestätigung
            }
        });

        if (authError) {
            console.error("Fehler bei Benutzerregistrierung:", JSON.stringify(authError));
            return {
                data: null,
                error: {
                    message: authError.message || 'Fehler bei der Benutzerregistrierung',
                    name: authError.name
                }
            };
        }

        if (!authData || !authData.user) {
            console.error("Benutzerregistrierung fehlgeschlagen: Kein Benutzer zurückgegeben");
            return {
                data: null,
                error: { message: 'Benutzerregistrierung fehlgeschlagen' }
            };
        }

        console.log("Benutzer erstellt:", authData.user.id);

        try {
            // Da die E-Mail-Bestätigung deaktiviert ist, können wir den Benutzer direkt als authentifiziert betrachten
            console.log("Versuche Spieler-Eintrag zu erstellen...");

            // Erstelle einen Eintrag in der players-Tabelle
            const { error: playerError } = await supabase
                .from('players')
                .insert({
                    id: authData.user.id,
                    name,
                    email
                });

            console.log("Ergebnis der Spieler-Erstellung:", playerError ? "Fehler" : "Erfolg");

            if (playerError) {
                console.error("Fehler beim Erstellen des Player-Eintrags:", JSON.stringify(playerError));

                // Versuche mit Admin-Rechten (wenn verfügbar)
                if (supabaseAdmin !== supabase) {
                    console.log("Versuche Spieler mit Admin-Rechten zu erstellen...");
                    const { error: adminPlayerError } = await supabaseAdmin
                        .from('players')
                        .insert({
                            id: authData.user.id,
                            name,
                            email
                        });

                    console.log("Ergebnis der Admin-Spieler-Erstellung:", adminPlayerError ? "Fehler" : "Erfolg");

                    if (adminPlayerError) {
                        console.error("Auch mit Admin-Rechten fehlgeschlagen:", JSON.stringify(adminPlayerError));
                        // Bei Fehler den Benutzer löschen
                        try {
                            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                            console.error("Benutzer nach Fehler gelöscht:", authData.user.id);
                        } catch (cleanupError) {
                            console.error("Konnte Benutzer nach Fehler nicht löschen:", cleanupError);
                        }

                        return {
                            data: null,
                            error: {
                                message: "Konnte Spielerdaten nicht anlegen. Bitte kontaktiere den Administrator.",
                                name: adminPlayerError.name
                            }
                        };
                    }
                } else {
                    // Wenn kein Admin-Client verfügbar, lösche den Benutzer und gib Fehler zurück
                    try {
                        await supabase.auth.admin.deleteUser(authData.user.id);
                        console.error("Benutzer nach Fehler gelöscht:", authData.user.id);
                    } catch (cleanupError) {
                        console.error("Konnte Benutzer nach Fehler nicht löschen:", cleanupError);
                    }

                    return {
                        data: null,
                        error: {
                            message: "Konnte Spielerdaten nicht anlegen. RLS-Fehler. Bitte kontaktiere den Administrator.",
                            name: playerError.name
                        }
                    };
                }
            }

            // Erstelle einen Eintrag in der profiles-Tabelle
            console.log("Versuche Profil-Eintrag zu erstellen...");
            const { error: profileError } = await supabase
                .from('profiles')
                .insert({
                    id: authData.user.id,
                    role
                });

            console.log("Ergebnis der Profil-Erstellung:", profileError ? "Fehler" : "Erfolg");

            if (profileError) {
                console.error("Fehler beim Erstellen des Profil-Eintrags:", JSON.stringify(profileError));

                // Versuche mit Admin-Rechten (wenn verfügbar)
                if (supabaseAdmin !== supabase) {
                    console.log("Versuche Profil mit Admin-Rechten zu erstellen...");
                    const { error: adminProfileError } = await supabaseAdmin
                        .from('profiles')
                        .insert({
                            id: authData.user.id,
                            role
                        });

                    console.log("Ergebnis der Admin-Profil-Erstellung:", adminProfileError ? "Fehler" : "Erfolg");

                    if (adminProfileError) {
                        console.error("Auch mit Admin-Rechten fehlgeschlagen:", JSON.stringify(adminProfileError));
                        // Bei Fehler in der Datenbank, den erstellten Benutzer wieder löschen
                        try {
                            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                            console.error("Benutzer nach Fehler gelöscht:", authData.user.id);
                        } catch (cleanupError) {
                            console.error("Konnte Benutzer nach Fehler nicht löschen:", cleanupError);
                        }

                        return {
                            data: null,
                            error: {
                                message: "Konnte Profildaten nicht anlegen. Bitte kontaktiere den Administrator.",
                                name: adminProfileError.name
                            }
                        };
                    }
                } else {
                    // Wenn kein Admin-Client verfügbar, lösche den Benutzer und gib Fehler zurück
                    try {
                        await supabase.auth.admin.deleteUser(authData.user.id);
                        console.error("Benutzer nach Fehler gelöscht:", authData.user.id);
                    } catch (cleanupError) {
                        console.error("Konnte Benutzer nach Fehler nicht löschen:", cleanupError);
                    }

                    return {
                        data: null,
                        error: {
                            message: "Konnte Profildaten nicht anlegen. RLS-Fehler. Bitte kontaktiere den Administrator.",
                            name: profileError.name
                        }
                    };
                }
            }

            // Anmelden des neuen Benutzers nach der Erstellung
            // Da wir emailConfirm: false gesetzt haben, sollte der Benutzer sofort anmeldbar sein
            console.log("Versuche automatische Anmeldung...");
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password: accessCode
            });

            console.log("Ergebnis der automatischen Anmeldung:", signInError ? "Fehler" : "Erfolg");

            if (signInError) {
                console.error("Fehler beim automatischen Anmelden nach Registrierung:", JSON.stringify(signInError));

                // Bei E-Mail-Bestätigungsfehlern nicht den Benutzer löschen
                if (signInError.code === 'email_not_confirmed') {
                    console.warn("E-Mail ist noch nicht bestätigt, Benutzer wurde trotzdem erstellt");

                    // Versuche den Admin-Client zu verwenden, um die E-Mail direkt zu bestätigen
                    if (supabaseAdmin !== supabase) {
                        try {
                            // Leider unterstützt Supabase bislang keine direkte E-Mail-Bestätigung per API
                            // Daher müssen wir einen Workaround anbieten - sende den Zugangscode an den Benutzer
                            console.log("Benutzer erstellt, aber automatische Anmeldung nicht möglich");
                        } catch (confirmError) {
                            console.error("Fehler bei der E-Mail-Bestätigung:", confirmError);
                        }
                    }

                    // Gib den Benutzer trotzdem zurück, damit er sich später anmelden kann
                    return {
                        data: authData,
                        error: {
                            message: 'Benutzer wurde erstellt, E-Mail-Bestätigung erforderlich.',
                            code: 'email_confirmation_required'
                        }
                    };
                }

                // Bei anderen Fehlern den Benutzer löschen
                try {
                    // Wir versuchen den Admin-Client zu verwenden wenn verfügbar
                    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                    console.error("Benutzer nach Anmeldefehler gelöscht:", authData.user.id);
                } catch (cleanupError) {
                    console.error("Konnte Benutzer nach Anmeldefehler nicht löschen:", cleanupError);
                }

                return {
                    data: null,
                    error: {
                        message: 'Anmeldung nach Registrierung fehlgeschlagen',
                        name: signInError.name
                    }
                };
            }

            console.log("Benutzer erfolgreich erstellt und angemeldet!");
            return { data: signInData || authData, error: null };
        } catch (dbError) {
            console.error("Datenbankfehler:", dbError);
            // Bei Fehler in der Datenbank, den erstellten Benutzer wieder löschen
            try {
                await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
                console.error("Benutzer nach Fehler gelöscht:", authData.user.id);
            } catch (cleanupError) {
                console.error("Konnte Benutzer nach Fehler nicht löschen:", cleanupError);
            }
            return {
                data: null,
                error: {
                    message: dbError.message || 'Datenbankfehler bei der Benutzerregistrierung',
                    name: dbError.name
                }
            };
        }
    } catch (error) {
        console.error("Unerwarteter Fehler bei Benutzerregistrierung:", error);
        return {
            data: null,
            error: {
                message: error.message || 'Unerwarteter Fehler bei der Benutzerregistrierung',
                name: error.name
            }
        };
    }
}

export const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
};

export const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
};

// Verbesserte getProfile-Funktion
export async function getProfile(userId) {
    // Prüfe zuerst den Cache
    const cachedData = cacheManager.get('profiles', userId);
    if (cachedData) {
        // Wenn die Daten frisch sind, verwende sie direkt
        if (cachedData.fresh) {
            return { data: cachedData.data, error: null };
        }
        // Wenn die Daten veraltet sind, gib sie zurück aber aktualisiere im Hintergrund
        setTimeout(() => fetchProfileData(userId), 0);
        return { data: cachedData.data, error: null, stale: true };
    }

    return fetchProfileData(userId);
}

// Separate Funktion für das tatsächliche Fetching
async function fetchProfileData(userId) {
    let attempt = 0;
    const maxAttempts = CACHE_CONFIG.MAX_RETRIES;

    while (attempt < maxAttempts) {
        try {
            // Erstelle ein Promise mit Timeout
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), CACHE_CONFIG.TIMEOUT)
            );

            // Führe die Datenbankabfragen parallel aus
            const [profileResult, playerResult] = await Promise.all([
                Promise.race([
                    supabase
                        .from('profiles')
                        .select('id, role')
                        .eq('id', userId)
                        .single(),
                    timeoutPromise
                ]),
                Promise.race([
                    supabase
                        .from('players')
                        .select('id, name, email')
                        .eq('id', userId)
                        .single(),
                    timeoutPromise
                ])
            ]);

            if (profileResult.error) throw profileResult.error;

            const combinedData = {
                ...profileResult.data,
                player: playerResult.error ? null : playerResult.data
            };

            // Speichere die erfolgreichen Daten im Cache
            cacheManager.set('profiles', combinedData, userId);

            return { data: combinedData, error: null };
        } catch (error) {
            console.error(`Fehler beim Abrufen des Profils (Versuch ${attempt + 1}/${maxAttempts}):`, error);

            // Wenn es der letzte Versuch war, prüfe auf Cache-Daten
            if (attempt === maxAttempts - 1) {
                const cachedData = cacheManager.get('profiles', userId);
                if (cachedData) {
                    return {
                        data: cachedData.data,
                        error: null,
                        stale: true
                    };
                }
                return { data: null, error };
            }

            // Warte vor dem nächsten Versuch
            await new Promise(resolve =>
                setTimeout(resolve, CACHE_CONFIG.RETRY_DELAY * Math.pow(2, attempt))
            );
            attempt++;
        }
    }
}

// Cache-Invalidierung
export const invalidateCache = (key = null) => {
    // Invalidiere den Cache-Manager
    cacheManager.clear(key);

    // Invalidiere den Query-Cache
    if (key === 'players' || key === null) {
        queryCache.players.data = null;
        queryCache.players.timestamp = 0;
        queryCache.players.version++;
    }
    if (key === 'rankings' || key === null) {
        queryCache.rankings.data = null;
        queryCache.rankings.timestamp = 0;
        queryCache.rankings.version++;
    }
    if (key === 'dailyRankings' || key === null) {
        queryCache.dailyRankings.data = {};
        queryCache.dailyRankings.timestamp = {};
        queryCache.dailyRankings.version++;
    }
};

// Benutzerrolle abrufen
export const getUserRole = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    return { data, error };
};

// Admin-Status prüfen
export const isAdmin = async (userId) => {
    const { data, error } = await getUserRole(userId);
    return data?.role === 'admin';
};

// Funktion zum Aktualisieren des Zugangscodes (für Admin)
export async function updateAccessCode(userId, newAccessCode) {
    try {
        const { data, error } = await supabase.auth.admin.updateUserById(
            userId,
            { password: newAccessCode }
        );

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

// Cache für Abfrageergebnisse mit Ablaufzeiten
const queryCache = {
    players: { data: null, timestamp: 0, version: 0 },
    rankings: { data: null, timestamp: 0, version: 0 },
    dailyRankings: { data: {}, timestamp: {}, version: 0 }
};

// Cache-Gültigkeitsdauer in Millisekunden
const CACHE_DURATION = 2 * 60 * 1000; // 2 Minuten

// Hilfsfunktion für Wiederholungsversuche bei Datenbankabfragen
async function retryQuery(queryFn, maxRetries = 5, initialDelayMs = 1000) {
    let lastError = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const result = await queryFn();
            return result;
        } catch (error) {
            console.warn(`Datenbankabfrage fehlgeschlagen (Versuch ${attempt + 1}/${maxRetries}):`, error);
            lastError = error;
            if (attempt < maxRetries - 1) {
                // Exponentielles Backoff mit zufälliger Jitter
                const delay = initialDelayMs * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// Hilfsfunktionen für Datenbank-Operationen
export const getPlayers = async (useCache = true) => {
    // Prüfe Cache, wenn erlaubt
    if (useCache &&
        queryCache.players.data &&
        Date.now() - queryCache.players.timestamp < CACHE_DURATION) {
        return { data: queryCache.players.data, error: null };
    }

    try {
        const result = await retryQuery(async () => {
            return await supabase
                .from('players')
                .select('id, name, email')
                .order('name');
        });

        // Aktualisiere Cache
        if (result.data && !result.error) {
            queryCache.players.data = result.data;
            queryCache.players.timestamp = Date.now();
            queryCache.players.version++;
        }

        return result;
    } catch (error) {
        console.error('Fehler beim Laden der Spieler (nach Wiederholungen):', error);
        return { data: null, error };
    }
};

export const getRankings = async (useCache = true, limit = 50) => {
    const STALE_CACHE_TIME = 5 * 60 * 1000; // 5 Minuten
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;

    // Prüfe Cache, wenn erlaubt
    if (useCache &&
        queryCache.rankings.data &&
        Date.now() - queryCache.rankings.timestamp < STALE_CACHE_TIME) {
        return { data: queryCache.rankings.data, error: null };
    }

    const fetchWithRetry = async (attempt = 0) => {
        try {
            const { data, error } = await supabase
                .rpc('get_all_time_rankings')
                .limit(limit);

            if (error) throw error;

            // Aktualisiere Cache nur bei erfolgreicher Abfrage
            if (data) {
                queryCache.rankings.data = data;
                queryCache.rankings.timestamp = Date.now();
                queryCache.rankings.version++;
            }

            return { data, error: null };
        } catch (error) {
            console.error(`Fehler beim Laden der Rangliste (Versuch ${attempt + 1}/${MAX_RETRIES}):`, error);

            if (attempt < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
                return fetchWithRetry(attempt + 1);
            }

            // Bei erschöpften Wiederholungsversuchen, prüfe ob wir einen veralteten Cache haben
            if (queryCache.rankings.data) {
                console.log('Verwende veraltete Cache-Daten nach fehlgeschlagenen Versuchen');
                return {
                    data: queryCache.rankings.data,
                    error: null,
                    stale: true
                };
            }

            return { data: null, error };
        }
    };

    return fetchWithRetry();
};

export const getDailyRankings = async (date, useCache = true, limit = 50) => {
    // Prüfe Cache, wenn erlaubt
    if (useCache &&
        queryCache.dailyRankings.data[date] &&
        Date.now() - queryCache.dailyRankings.timestamp[date] < CACHE_DURATION) {
        return { data: queryCache.dailyRankings.data[date], error: null };
    }

    try {
        const result = await retryQuery(async () => {
            return await supabase
                .rpc('get_daily_rankings', { target_date: date })
                .limit(limit);
        });

        // Aktualisiere Cache
        if (result.data && !result.error) {
            queryCache.dailyRankings.data[date] = result.data;
            queryCache.dailyRankings.timestamp[date] = Date.now();
            queryCache.dailyRankings.version++;
        }

        return result;
    } catch (error) {
        // Keine Toast-Nachricht mehr hier
        console.error(`Fehler beim Laden des Rankings für ${date} (nach Wiederholungen):`, error);
        return { data: null, error };
    }
};

// Funktion zum Aktualisieren des Benutzerprofils
export async function updateProfile(userId, updates) {
    try {
        // Aktualisiere die players-Tabelle, wenn name oder email geändert wurden
        if (updates.name || updates.email) {
            const playerUpdates = {};
            if (updates.name) playerUpdates.name = updates.name;
            if (updates.email) playerUpdates.email = updates.email;

            const { error: playerError } = await supabase
                .from('players')
                .update(playerUpdates)
                .eq('id', userId);

            if (playerError) {
                console.error('Fehler beim Aktualisieren des Spielers:', playerError);
                return { error: playerError };
            }
        }

        // Aktualisiere die profiles-Tabelle
        const profileUpdates = { ...updates };
        delete profileUpdates.name; // Entferne Felder, die nicht zur profiles-Tabelle gehören
        delete profileUpdates.email;

        if (Object.keys(profileUpdates).length > 0) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update(profileUpdates)
                .eq('id', userId);

            if (profileError) {
                console.error('Fehler beim Aktualisieren des Profils:', profileError);
                return { error: profileError };
            }
        }

        // Invalidiere den Cache für diesen Benutzer
        invalidateCache('profiles');

        // Hole das aktualisierte Profil
        const { data: updatedProfile, error: fetchError } = await getProfile(userId);

        if (fetchError) {
            console.error('Fehler beim Abrufen des aktualisierten Profils:', fetchError);
            return { error: fetchError };
        }

        return { data: updatedProfile, error: null };
    } catch (error) {
        console.error('Unerwarteter Fehler beim Aktualisieren des Profils:', error);
        return { error };
    }
} 