import { createBrowserClient } from '@supabase/ssr';

// Typ-Definitionen für die Datenbank (vereinfacht)
export function createClient() {
    return createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
}

// Direkte Verbindungskonfiguration zur Behandlung von Timeouts
const DIRECT_CONNECTION = {
    enabled: process.env.NEXT_PUBLIC_USE_DIRECT_CONNECTION === 'true',
    url: process.env.NEXT_PUBLIC_SUPABASE_DIRECT_URL
};

// Einfache Singleton-Instanz des Supabase-Clients
export const supabase = createClient();

// Cache für Spieler, Ranglisten, etc.
const CACHE = {
    players: { data: null, timestamp: 0 },
    rankings: { data: null, timestamp: 0 },
    dailyRankings: {},
    games: { data: null, timestamp: 0 }
};

// Cache-Gültigkeitsdauer
const CACHE_TTL = 60000; // 60 Sekunden

// Cache invalidieren
export const invalidateCache = (key = null) => {
    if (key) {
        if (key === 'dailyRankings') {
            CACHE.dailyRankings = {};
        } else if (CACHE[key]) {
            CACHE[key] = { data: null, timestamp: 0 };
        }
    } else {
        // Alle Caches zurücksetzen
        Object.keys(CACHE).forEach(cacheKey => {
            if (cacheKey === 'dailyRankings') {
                CACHE.dailyRankings = {};
            } else {
                CACHE[cacheKey] = { data: null, timestamp: 0 };
            }
        });
    }
};

// Standardmäßige Helper-Funktionen für die Authentifizierung
export async function signInWithMagicLink(email) {
    try {
        const redirectTo = typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`;

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

// Anmeldung mit Zugangscode
export async function signInWithAccessCode(email, accessCode) {
    try {
        // Direkt mit Email und Passwort anmelden ohne Prüfung der access_codes Tabelle
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: accessCode
        });

        if (error) {
            throw error;
        }

        return { data, error: null };
    } catch (error) {
        console.error('Anmeldefehler:', error);
        return { data: null, error };
    }
}

// Benutzer mit Zugangscode erstellen
export async function createUserWithAccessCode(email, name, accessCode, role = 'player') {
    try {
        // Direkt Benutzer erstellen ohne Prüfung der access_codes Tabelle
        // Benutzer mit Supabase Auth erstellen
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password: accessCode,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (authError) {
            throw authError;
        }

        // Benutzer in der Players-Tabelle erstellen (vereinfacht - nur noch eine Tabelle!)
        if (authData?.user) {
            const { error: playerError } = await supabase
                .from('players')
                .insert({
                    id: authData.user.id,
                    name,
                    email,
                    role: role || 'player'
                });

            if (playerError) {
                console.error('Player-Erstellungsfehler:', playerError);
                return {
                    data: authData,
                    error: { message: 'Benutzer erstellt, aber Player-Fehler: ' + playerError.message }
                };
            }
        }

        return { data: authData, error: null };
    } catch (error) {
        console.error('Fehler bei der Benutzerregistrierung:', error);
        return { data: null, error };
    }
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
}

export async function getUserRole(userId) {
    const { data, error } = await supabase
        .from('players')
        .select('role')
        .eq('id', userId)
        .single();

    return { data, error };
}

export async function isAdmin(userId) {
    const { data, error } = await getUserRole(userId);
    return data?.role === 'admin';
}

// Helfer-Funktion zur Verbindungsprüfung (vereinfacht)
export async function checkConnection() {
    try {
        // Verwende eine einfache Zeitstempelabfrage, die keine Daten zurückgibt
        const { error } = await supabase
            .from('players')
            .select('count')
            .limit(1)
            .single()
            .throwOnError();  // Stellt sicher, dass Fehler geworfen werden

        return !error;
    } catch (err) {
        console.error('Verbindungsfehler beim Prüfen der Supabase-Verbindung:', err);
        return false;
    }
}

// Verbindung zur Datenbank wiederherstellen (für layout.client.js)
export async function reconnectSupabase() {
    // Überprüft die Verbindung und gibt zurück, ob sie erfolgreich hergestellt wurde
    return await checkConnection();
}

// Profil-bezogene Funktionen
export async function getProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('id, name, email, role, avatar_url, created_at, deleted_at')
            .eq('id', userId)
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Fehler beim Abrufen des Profils:', error);
        return { data: null, error };
    }
}

export async function updateProfile(userId, updates) {
    try {
        const { data, error } = await supabase
            .from('players')
            .update(updates)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;

        return { data, error: null };
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Profils:', error);
        return { data: null, error };
    }
}

export async function updateAccessCode(userId, newAccessCode) {
    try {
        // Berechtigung prüfen
        const { data: userData } = await supabase.auth.getUser();
        const currentUser = userData?.user;

        if (!currentUser || currentUser.id !== userId) {
            return {
                error: {
                    message: 'Nur der eigene Zugangscode kann geändert werden'
                }
            };
        }

        // Passwort (= Zugangscode) ändern
        const { error } = await supabase.auth.updateUser({
            password: newAccessCode,
        });

        if (error) throw error;

        return { data: { success: true }, error: null };
    } catch (error) {
        console.error('Fehler beim Aktualisieren des Zugangscodes:', error);
        return { data: null, error };
    }
}

// Rankings-bezogene Funktionen
export async function getRankings(useCache = true, limit = 50) {
    try {
        // Cache verwenden, wenn angefordert und gültig
        if (useCache && CACHE.rankings.data && Date.now() - CACHE.rankings.timestamp < CACHE_TTL) {
            return { data: CACHE.rankings.data, error: null };
        }

        // Direkte Abfrage auf die games-Tabelle mit Scores
        const { data: gamesData, error: gamesError } = await supabase
            .from('games')
            .select(`
                id, 
                player1_id, 
                player2_id, 
                winner_id, 
                created_at,
                scores(id, player1_score, player2_score)
            `)
            .eq('status', 'completed');

        if (gamesError) throw gamesError;

        // Manuell Rankings berechnen
        const playerStats = {};

        // Daten für jedes Spiel verarbeiten
        if (gamesData && gamesData.length > 0) {
            gamesData.forEach(game => {
                const player1Id = game.player1_id;
                const player2Id = game.player2_id;
                const winnerId = game.winner_id;
                const scores = game.scores || [];

                // Spielerstatistiken für Spieler 1 initialisieren
                if (!playerStats[player1Id]) {
                    playerStats[player1Id] = {
                        player_id: player1Id,
                        games_played: 0,
                        games_won: 0,
                        total_points: 0,
                        win_percentage: 0
                    };
                }

                // Spielerstatistiken für Spieler 2 initialisieren
                if (!playerStats[player2Id]) {
                    playerStats[player2Id] = {
                        player_id: player2Id,
                        games_played: 0,
                        games_won: 0,
                        total_points: 0,
                        win_percentage: 0
                    };
                }

                // Spielstatistiken aktualisieren
                playerStats[player1Id].games_played++;
                playerStats[player2Id].games_played++;

                // Aktualisiere Sieg-Statistik
                if (winnerId === player1Id) {
                    playerStats[player1Id].games_won++;
                } else if (winnerId === player2Id) {
                    playerStats[player2Id].games_won++;
                }

                // Punkte aus den Scores hinzufügen
                scores.forEach(score => {
                    if (score && typeof score.player1_score === 'number' && typeof score.player2_score === 'number') {
                        // Punkte für Spieler 1 hinzufügen
                        playerStats[player1Id].total_points += score.player1_score;

                        // Punkte für Spieler 2 hinzufügen
                        playerStats[player2Id].total_points += score.player2_score;
                    }
                });
            });
        }

        // Winrate berechnen und zu Array konvertieren
        const rankings = Object.values(playerStats).map(player => {
            player.win_percentage = player.games_played > 0
                ? (player.games_won / player.games_played) * 100
                : 0;
            return player;
        });

        // Nach Winrate sortieren, bei Gleichstand nach Siegen und dann nach Punkten
        rankings.sort((a, b) => {
            // Primär nach Winrate
            if (b.win_percentage !== a.win_percentage) {
                return b.win_percentage - a.win_percentage;
            }
            // Sekundär nach Siegen
            if (b.games_won !== a.games_won) {
                return b.games_won - a.games_won;
            }
            // Tertiär nach Punkten
            return b.total_points - a.total_points;
        });

        // Auf Limit beschränken
        const limitedRankings = rankings.slice(0, limit);

        // Spielernamen und Avatare hinzufügen
        const playerIds = limitedRankings.map(player => player.player_id);
        if (playerIds.length > 0) {
            const { data: playerData } = await supabase
                .from('players')
                .select('id, name, avatar_url')
                .in('id', playerIds);

            if (playerData) {
                limitedRankings.forEach(player => {
                    const playerInfo = playerData.find(p => p.id === player.player_id);
                    player.player_name = playerInfo?.name || 'Unbekannt';
                    player.avatar_url = playerInfo?.avatar_url || null;
                });
            }
        }

        // Cache aktualisieren
        CACHE.rankings.data = limitedRankings;
        CACHE.rankings.timestamp = Date.now();

        return { data: limitedRankings, error: null };
    } catch (error) {
        console.error('Fehler beim Abrufen der Rangliste:', error);
        return { data: null, error };
    }
}

export async function getDailyRankings(date, useCache = true, limit = 50) {
    try {
        // Cache-Schlüssel
        const cacheKey = date;

        // Cache verwenden, wenn angefordert und gültig
        if (useCache && CACHE.dailyRankings[cacheKey]?.data &&
            Date.now() - CACHE.dailyRankings[cacheKey].timestamp < CACHE_TTL) {
            return { data: CACHE.dailyRankings[cacheKey].data, error: null };
        }

        // Startdatum und Enddatum für den gewählten Tag
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        // Direkte Abfrage auf die games-Tabelle mit Scores
        const { data: gamesData, error: gamesError } = await supabase
            .from('games')
            .select(`
                id, 
                player1_id, 
                player2_id, 
                winner_id, 
                created_at,
                scores(id, player1_score, player2_score)
            `)
            .eq('status', 'completed')
            .gte('created_at', startDate.toISOString())
            .lte('created_at', endDate.toISOString());

        if (gamesError) throw gamesError;

        // Manuell Rankings berechnen
        const playerStats = {};

        // Daten für jedes Spiel verarbeiten
        if (gamesData && gamesData.length > 0) {
            gamesData.forEach(game => {
                const player1Id = game.player1_id;
                const player2Id = game.player2_id;
                const winnerId = game.winner_id;
                const scores = game.scores || [];

                // Spielerstatistiken für Spieler 1 initialisieren
                if (!playerStats[player1Id]) {
                    playerStats[player1Id] = {
                        player_id: player1Id,
                        games_played: 0,
                        games_won: 0,
                        daily_points: 0,
                        win_percentage: 0,
                        ranking_date: date
                    };
                }

                // Spielerstatistiken für Spieler 2 initialisieren
                if (!playerStats[player2Id]) {
                    playerStats[player2Id] = {
                        player_id: player2Id,
                        games_played: 0,
                        games_won: 0,
                        daily_points: 0,
                        win_percentage: 0,
                        ranking_date: date
                    };
                }

                // Spielstatistiken aktualisieren
                playerStats[player1Id].games_played++;
                playerStats[player2Id].games_played++;

                // Aktualisiere Sieg-Statistik
                if (winnerId === player1Id) {
                    playerStats[player1Id].games_won++;
                } else if (winnerId === player2Id) {
                    playerStats[player2Id].games_won++;
                }

                // Punkte aus den Scores hinzufügen
                scores.forEach(score => {
                    if (score && typeof score.player1_score === 'number' && typeof score.player2_score === 'number') {
                        // Punkte für Spieler 1 hinzufügen
                        playerStats[player1Id].daily_points += score.player1_score;

                        // Punkte für Spieler 2 hinzufügen
                        playerStats[player2Id].daily_points += score.player2_score;
                    }
                });
            });
        }

        // Winrate berechnen und zu Array konvertieren
        const rankings = Object.values(playerStats).map(player => {
            player.win_percentage = player.games_played > 0
                ? (player.games_won / player.games_played) * 100
                : 0;
            return player;
        });

        // Nach Winrate sortieren, bei Gleichstand nach Siegen und dann nach Punkten
        rankings.sort((a, b) => {
            // Primär nach Winrate
            if (b.win_percentage !== a.win_percentage) {
                return b.win_percentage - a.win_percentage;
            }
            // Sekundär nach Siegen
            if (b.games_won !== a.games_won) {
                return b.games_won - a.games_won;
            }
            // Tertiär nach Punkten (bei Tagesrangliste sind es daily_points)
            return b.daily_points - a.daily_points;
        });

        // Auf Limit beschränken
        const limitedRankings = rankings.slice(0, limit);

        // Spielernamen und Avatare hinzufügen
        const playerIds = limitedRankings.map(player => player.player_id);
        if (playerIds.length > 0) {
            const { data: playerData } = await supabase
                .from('players')
                .select('id, name, avatar_url')
                .in('id', playerIds);

            if (playerData) {
                const playerMap = {};
                playerData.forEach(player => {
                    playerMap[player.id] = player.name;
                });

                limitedRankings.forEach(player => {
                    const playerInfo = playerData.find(p => p.id === player.player_id);
                    player.player_name = playerInfo?.name || 'Unbekannt';
                    player.avatar_url = playerInfo?.avatar_url || null;
                });
            }
        }

        // Cache aktualisieren
        CACHE.dailyRankings[cacheKey] = {
            data: limitedRankings,
            timestamp: Date.now()
        };

        return { data: limitedRankings, error: null };
    } catch (error) {
        console.error('Fehler beim Abrufen der Tagesrangliste:', error);
        return { data: null, error };
    }
}

export async function getAvailableDates() {
    try {
        // Hole alle abgeschlossenen Spiele
        const { data: gamesData, error: gamesError } = await supabase
            .from('games')
            .select('created_at')
            .eq('status', 'completed')
            .order('created_at', { ascending: false });

        if (gamesError) throw gamesError;

        // Extrahiere nur das Datum (ohne Uhrzeit) aus jedem created_at
        const datesSet = new Set();
        if (gamesData && gamesData.length > 0) {
            gamesData.forEach(game => {
                const date = new Date(game.created_at);
                const dateString = date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
                datesSet.add(dateString);
            });
        }

        // Konvertiere in Array und beschränke auf 30 Einträge
        const uniqueDates = [...datesSet].slice(0, 30);

        return { data: uniqueDates, error: null };
    } catch (error) {
        console.error('Fehler beim Abrufen der verfügbaren Daten:', error);
        return { data: null, error };
    }
}

// Spielbezogene Funktionen
export async function getGames(options = {}) {
    try {
        const {
            playerId = null,
            status = null,
            limit = 50,
            useCache = true,
            withPlayers = true
        } = options;

        // Cache verwenden, wenn angefordert und gültig
        if (useCache && !playerId && !status && CACHE.games.data &&
            Date.now() - CACHE.games.timestamp < CACHE_TTL) {
            return { data: CACHE.games.data, error: null };
        }

        // Basisabfrage
        let query = supabase
            .from('games')
            .select(`
                *,
                ${withPlayers ? `
                player1:player1_id(id, name, email, avatar_url, created_at),
                player2:player2_id(id, name, email, avatar_url, created_at),
                ` : ''}
                scores(*)
            `)
            .order('created_at', { ascending: false });

        // Filter hinzufügen
        if (playerId) {
            query = query.or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`);
        }

        if (status) {
            query = query.eq('status', status);
        }

        // Limit hinzufügen
        if (limit) {
            query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Cache aktualisieren, wenn keine speziellen Filter
        if (!playerId && !status && data) {
            CACHE.games.data = data;
            CACHE.games.timestamp = Date.now();
        }

        return { data, error: null };
    } catch (error) {
        console.error('Fehler beim Abrufen der Spiele:', error);
        return { data: null, error };
    }
}

// Spielerbezogene Funktionen
export async function getPlayers(useCache = true) {
    try {
        // Cache verwenden, wenn angefordert und gültig
        if (useCache && CACHE.players.data && Date.now() - CACHE.players.timestamp < CACHE_TTL) {
            return { data: CACHE.players.data, error: null };
        }

        const { data, error } = await supabase
            .from('players')
            .select('*')
            .order('name', { ascending: true });

        if (error) throw error;

        // Cache aktualisieren
        if (data) {
            CACHE.players.data = data;
            CACHE.players.timestamp = Date.now();
        }

        return { data, error: null };
    } catch (error) {
        console.error('Fehler beim Abrufen der Spieler:', error);
        return { data: null, error };
    }
}

// Profil vollständig löschen (inklusive aller Spieldaten und Auth-User)
export async function deleteProfile(userId) {
    try {
        // Hole das aktuelle Auth-Token
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            throw new Error('Nicht angemeldet');
        }

        console.log('🗑️ Starting complete profile deletion...');

        // Verwende die neue vollständige Lösch-Function
        const { data, error } = await supabase.functions.invoke('delete-user-complete', {
            headers: {
                Authorization: `Bearer ${session.access_token}`,
            },
        });

        if (error) {
            console.error('Edge Function error:', error);
            throw error;
        }

        if (!data.success) {
            console.error('Deletion failed:', data);
            throw new Error(data.error || data.details || 'Unbekannter Fehler beim Löschen');
        }

        console.log('✅ Profile deletion successful:', data.deletionSummary);

        // Cache invalidieren
        invalidateCache();

        return {
            success: true,
            error: null,
            message: data.message,
            deletionSummary: data.deletionSummary
        };
    } catch (error) {
        console.error('Fehler beim Löschen des Profils:', error);
        return { success: false, error };
    }
}

// Avatar-bezogene Funktionen
export async function uploadAvatar(userId, file) {
    try {
        // Validierung
        if (!file) {
            throw new Error('Keine Datei ausgewählt');
        }

        // Dateigröße prüfen (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB in Bytes
        if (file.size > maxSize) {
            throw new Error('Datei ist zu groß. Maximale Größe: 5MB');
        }

        // Dateityp prüfen
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            throw new Error('Ungültiger Dateityp. Erlaubt: JPG, PNG, WebP');
        }

        // Eindeutigen Dateinamen generieren
        const timestamp = Date.now();
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const fileName = `${userId}/${timestamp}.${fileExtension}`;

        console.log('🖼️ Uploading avatar:', fileName);

        // Altes Avatar löschen (falls vorhanden)
        await deleteOldAvatar(userId);

        // Datei hochladen
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('Upload error:', error);
            throw error;
        }

        console.log('✅ Avatar uploaded successfully:', data);

        // Öffentliche URL generieren
        const { data: urlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const avatarUrl = urlData.publicUrl;

        // Avatar-URL in der Datenbank speichern
        const { error: updateError } = await supabase
            .from('players')
            .update({ avatar_url: avatarUrl })
            .eq('id', userId);

        if (updateError) {
            console.error('Database update error:', updateError);
            // Versuche hochgeladene Datei zu löschen, da DB-Update fehlgeschlagen
            await supabase.storage.from('avatars').remove([fileName]);
            throw updateError;
        }

        console.log('✅ Avatar URL updated in database');

        // Cache invalidieren
        invalidateCache('players');

        return {
            success: true,
            avatarUrl,
            message: 'Profilbild erfolgreich hochgeladen'
        };

    } catch (error) {
        console.error('Fehler beim Avatar-Upload:', error);
        return {
            success: false,
            error: error.message || 'Unbekannter Fehler beim Upload'
        };
    }
}

export async function deleteAvatar(userId) {
    try {
        console.log('🗑️ Deleting avatar for user:', userId);

        // Aktuelle Avatar-URL aus der Datenbank holen
        const { data: playerData, error: fetchError } = await supabase
            .from('players')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        if (!playerData?.avatar_url) {
            return {
                success: true,
                message: 'Kein Avatar zum Löschen vorhanden'
            };
        }

        // Dateiname aus URL extrahieren
        const fileName = extractFileNameFromUrl(playerData.avatar_url);

        if (fileName) {
            // Datei aus Storage löschen
            const { error: deleteError } = await supabase.storage
                .from('avatars')
                .remove([fileName]);

            if (deleteError) {
                console.warn('Storage deletion warning:', deleteError);
            }
        }

        // Avatar-URL aus Datenbank entfernen
        const { error: updateError } = await supabase
            .from('players')
            .update({ avatar_url: null })
            .eq('id', userId);

        if (updateError) {
            throw updateError;
        }

        console.log('✅ Avatar deleted successfully');

        // Cache invalidieren
        invalidateCache('players');

        return {
            success: true,
            message: 'Profilbild erfolgreich gelöscht'
        };

    } catch (error) {
        console.error('Fehler beim Avatar-Löschen:', error);
        return {
            success: false,
            error: error.message || 'Unbekannter Fehler beim Löschen'
        };
    }
}

// Hilfsfunktion: Altes Avatar löschen
async function deleteOldAvatar(userId) {
    try {
        const { data: playerData } = await supabase
            .from('players')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (playerData?.avatar_url) {
            const fileName = extractFileNameFromUrl(playerData.avatar_url);
            if (fileName) {
                await supabase.storage.from('avatars').remove([fileName]);
                console.log('🗑️ Old avatar deleted:', fileName);
            }
        }
    } catch (error) {
        console.warn('Warning: Could not delete old avatar:', error);
    }
}

// Hilfsfunktion: Dateiname aus URL extrahieren
function extractFileNameFromUrl(url) {
    try {
        if (!url) return null;

        // URL-Pfad nach "avatars/" suchen
        const match = url.match(/avatars\/(.+)$/);
        return match ? match[1] : null;
    } catch (error) {
        console.warn('Could not extract filename from URL:', url);
        return null;
    }
}

// Hilfsfunktion: Avatar-URL für Benutzer abrufen
export async function getAvatarUrl(userId) {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('avatar_url')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn('Could not fetch avatar URL:', error);
            return null;
        }

        return data?.avatar_url || null;
    } catch (error) {
        console.warn('Error fetching avatar URL:', error);
        return null;
    }
}

// Hilfsfunktion: Standard-Avatar generieren (Initialen)
export function generateDefaultAvatar(name) {
    if (!name) return null;

    const initials = name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .substring(0, 2);

    // Generiere eine einfache SVG mit Initialen (grau)
    const svg = `data:image/svg+xml;base64,${btoa(`
        <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#6b7280"/>
            <text x="50" y="50" text-anchor="middle" dy="0.35em" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white">
                ${initials}
            </text>
        </svg>
    `)}`;

    return svg;
} 