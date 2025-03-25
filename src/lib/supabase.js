import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

// Erstelle den Supabase-Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Für Admin-Operationen die RLS umgehen
export const supabaseAdmin = typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false }
    })
    : supabase; // Im Browser oder wenn der Service Role Key nicht verfügbar ist, falle auf normale Rechte zurück

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
        console.log("Anmeldung versuchen für:", email);

        // Prüfe zuerst, ob der Zugangscode korrekt ist
        const globalAccessCode = process.env.NEXT_PUBLIC_GLOBAL_ACCESS_CODE;

        // Wenn der eingegebene Code nicht mit dem globalen Code übereinstimmt, gib einen Fehler zurück
        if (!globalAccessCode) {
            console.error("Globaler Zugangscode ist nicht konfiguriert");
            return {
                data: null,
                error: { message: 'Zugangscode-Konfiguration fehlt' }
            };
        }

        console.log("Prüfe Zugangscode...");
        if (accessCode !== globalAccessCode) {
            console.error("Falscher Zugangscode eingegeben:", accessCode);
            return {
                data: null,
                error: { message: 'Der Zugangscode ist nicht korrekt.' }
            };
        }

        // Wenn der Code korrekt ist, versuche den Benutzer zu authentifizieren
        try {
            console.log("Zugangscode korrekt, versuche Anmeldung bei Supabase...");

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password: accessCode // Wir verwenden den gleichen Code als Passwort
            });

            if (error) {
                console.error("Login-Fehler:", JSON.stringify(error));

                // Wenn der Benutzer nicht existiert
                if (error.message && (
                    error.message.includes('Invalid login credentials') ||
                    error.message.includes('User not found')
                )) {
                    console.log("Benutzer nicht gefunden, leite zur Registrierung weiter...");
                    return {
                        data: null,
                        error: { message: 'Benutzer nicht gefunden. Bitte registrieren Sie sich.' }
                    };
                }

                return {
                    data: null,
                    error: {
                        message: error.message || 'Anmeldung fehlgeschlagen',
                        status: error.status,
                        name: error.name
                    }
                };
            }

            if (!data || !data.user) {
                console.error("Login fehlgeschlagen: Keine Benutzerdaten zurückgegeben");
                return {
                    data: null,
                    error: { message: 'Anmeldung fehlgeschlagen' }
                };
            }

            console.log("Anmeldung erfolgreich, Benutzer-ID:", data.user.id);
            return { data, error: null };
        } catch (authError) {
            console.error("Authentifizierungsfehler:", authError);
            return {
                data: null,
                error: {
                    message: authError.message || 'Fehler bei der Authentifizierung',
                    name: authError.name
                }
            };
        }
    } catch (error) {
        console.error("Unerwarteter Fehler bei der Anmeldung:", error);
        return {
            data: null,
            error: {
                message: error.message || 'Unerwarteter Fehler bei der Anmeldung',
                name: error.name
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

// Cache für Profile-Daten hinzufügen
const profileCache = {
    data: {},
    timestamp: {},
    version: 0
};

// Funktion zum Aktualisieren des eigenen Profils
export async function getProfile(userId) {
    const CACHE_DURATION = 30 * 1000; // 30 Sekunden Cache
    const MAX_RETRIES = 2; // Weniger Wiederholungsversuche
    const RETRY_DELAY = 500; // Kürzere Verzögerung

    // Prüfe Cache
    if (profileCache.data[userId] &&
        Date.now() - profileCache.timestamp[userId] < CACHE_DURATION) {
        return { data: profileCache.data[userId], error: null };
    }

    const fetchWithRetry = async (attempt = 0) => {
        try {
            // Optimierte Abfrage mit weniger Feldern
            const [profileResult, playerResult] = await Promise.all([
                supabase
                    .from('profiles')
                    .select('id, role')
                    .eq('id', userId)
                    .single()
                    .timeout(3000), // Timeout nach 3 Sekunden
                supabase
                    .from('players')
                    .select('id, name, email')
                    .eq('id', userId)
                    .single()
                    .timeout(3000)
            ]);

            // Überprüfe auf Fehler
            if (profileResult.error) throw profileResult.error;

            // Kombiniere die Daten
            const combinedData = {
                ...profileResult.data,
                player: playerResult.error ? null : playerResult.data
            };

            // Aktualisiere Cache
            profileCache.data[userId] = combinedData;
            profileCache.timestamp[userId] = Date.now();
            profileCache.version++;

            return { data: combinedData, error: null };
        } catch (error) {
            console.error(`Fehler beim Abrufen des Profils (Versuch ${attempt + 1}/${MAX_RETRIES}):`, error);

            if (attempt < MAX_RETRIES - 1) {
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt)));
                return fetchWithRetry(attempt + 1);
            }

            // Bei Fehler versuche veraltete Cache-Daten zu verwenden
            if (profileCache.data[userId]) {
                console.log('Verwende veraltete Cache-Daten nach Fehler');
                return {
                    data: profileCache.data[userId],
                    error: null,
                    stale: true
                };
            }

            return { data: null, error };
        }
    };

    return fetchWithRetry();
}

// Funktion zum Aktualisieren des eigenen Profils
export async function updateProfile(userId, updates) {
    try {
        // Aktualisiere den Spieler-Eintrag
        const { error: playerError } = await supabase
            .from('players')
            .update({
                name: updates.name,
                // Weitere Spieler-Felder hier
            })
            .eq('id', userId);

        if (playerError) throw playerError;

        return { data: { success: true }, error: null };
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

// Cache invalidieren bei Aktualisierung der Daten
export const invalidateCache = (key = null) => {
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
    if (key === 'profile' || key === null) {
        profileCache.data = {};
        profileCache.timestamp = {};
        profileCache.version++;
    }
};

export const getUserRole = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

    return { data, error };
};

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