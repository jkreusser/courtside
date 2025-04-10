# Supabase Einrichtungsanleitung

Diese Anleitung erklärt, wie du deine Supabase-Datenbank für die Squash-App einrichtest.

## 1. Datenbank-Tabellen erstellen

Führe folgende SQL-Befehle in der SQL-Konsole deines Supabase-Projekts aus:

```sql
-- Spieler-Tabelle
CREATE TABLE public.players (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Profile-Tabelle (für Benutzerrollen)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'player', -- 'admin' oder 'player'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Matches-Tabelle
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    score_player1 INTEGER DEFAULT 0 NOT NULL,
    score_player2 INTEGER DEFAULT 0 NOT NULL,
    game_date DATE DEFAULT CURRENT_DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Games-Tabelle
CREATE TABLE public.games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    winner_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'in_progress' NOT NULL,
    sets_to_win INTEGER DEFAULT 3 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Scores-Tabelle (für Spielergebnisse)
CREATE TABLE public.scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES public.games(id) ON DELETE CASCADE,
    player1_score INTEGER NOT NULL,
    player2_score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Spielplan-Tabellen
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    court_count INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.schedule_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
    player1_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    player2_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    court INTEGER NOT NULL,
    round INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Rankings-Funktionen
CREATE OR REPLACE FUNCTION get_all_time_rankings()
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    games_played INTEGER,
    games_won INTEGER,
    win_percentage NUMERIC,
    last_played TIMESTAMP WITH TIME ZONE,
    total_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH games_data AS (
        SELECT
            p.id as player_id,
            p.name as player_name,
            COUNT(g.*)::INTEGER as games_played,
            SUM(CASE WHEN g.winner_id = p.id THEN 1 ELSE 0 END)::INTEGER as games_won,
            MAX(g.updated_at) as last_played,
            SUM(
                CASE 
                    WHEN p.id = g.player1_id THEN (
                        SELECT COALESCE(SUM(player1_score), 0) 
                        FROM scores 
                        WHERE game_id = g.id
                    )
                    ELSE (
                        SELECT COALESCE(SUM(player2_score), 0) 
                        FROM scores 
                        WHERE game_id = g.id
                    )
                END
            )::INTEGER as total_points
        FROM
            players p
        JOIN games g ON (p.id = g.player1_id OR p.id = g.player2_id)
        WHERE g.status = 'completed'
        GROUP BY p.id, p.name
    )
    SELECT
        gd.player_id,
        gd.player_name,
        gd.games_played,
        gd.games_won,
        CASE WHEN gd.games_played > 0 THEN (gd.games_won::NUMERIC / gd.games_played) * 100 ELSE 0 END as win_percentage,
        gd.last_played,
        gd.total_points
    FROM
        games_data gd
    ORDER BY
        win_percentage DESC, games_won DESC, player_name ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_daily_rankings(target_date DATE)
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    games_played INTEGER,
    games_won INTEGER,
    win_percentage NUMERIC,
    daily_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH games_data AS (
        SELECT
            p.id as player_id,
            p.name as player_name,
            COUNT(m.*)::INTEGER as games_played,
            SUM(CASE 
                WHEN (m.player1_id = p.id AND m.score_player1 > m.score_player2) OR 
                     (m.player2_id = p.id AND m.score_player2 > m.score_player1) 
                THEN 1 
                ELSE 0 
            END)::INTEGER as games_won,
            SUM(
                CASE 
                    WHEN p.id = m.player1_id THEN m.score_player1
                    ELSE m.score_player2
                END
            )::INTEGER as daily_points
        FROM
            players p
        JOIN matches m ON (p.id = m.player1_id OR p.id = m.player2_id)
        WHERE m.is_complete = true AND m.date = target_date
        GROUP BY p.id, p.name
    )
    SELECT
        gd.player_id,
        gd.player_name,
        gd.games_played,
        gd.games_won,
        CASE WHEN gd.games_played > 0 THEN (gd.games_won::NUMERIC / gd.games_played) * 100 ELSE 0 END as win_percentage,
        gd.daily_points
    FROM
        games_data gd
    ORDER BY
        win_percentage DESC, games_won DESC, player_name ASC;
END;
$$ LANGUAGE plpgsql;
```

## 2. Row Level Security (RLS) Policies einrichten

Führe folgende SQL-Befehle aus, um RLS für die Tabellen zu aktivieren und die entsprechenden Policies zu definieren:

```sql
-- RLS aktivieren
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Policy für Spieler: Jeder kann alle Spieler sehen (auch ohne Anmeldung)
CREATE POLICY "Jeder kann alle Spieler sehen"
ON public.players FOR SELECT
TO anon, authenticated
USING (true);

-- Policy für Spieler: Nur Admin kann Spieler erstellen
CREATE POLICY "Nur Admin und eigene Spieler können Spieler erstellen"
ON public.players FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = id OR  -- Der Benutzer kann sich selbst erstellen
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Spieler: Nur Admin und der Spieler selbst können Spielerdaten aktualisieren
CREATE POLICY "Nur Admin und eigene Spieler können Spieler aktualisieren"
ON public.players FOR UPDATE
TO authenticated
USING (
    auth.uid() = id OR  -- Der Benutzer kann seine eigenen Daten aktualisieren
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Profile: Jeder kann sein eigenes Profil lesen
CREATE POLICY "Benutzer können ihr eigenes Profil lesen" 
ON public.profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Policy für Profile: Admins können alle Profile lesen
CREATE POLICY "Admins können alle Profile lesen" 
ON public.profiles FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Profile: Jeder kann sein eigenes Profil erstellen
CREATE POLICY "Benutzer können ihr eigenes Profil erstellen" 
ON public.profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Policy für Profile: Nur Admin kann Profile aktualisieren
CREATE POLICY "Nur Admin kann Profile aktualisieren" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Matches: Jeder kann Matches sehen (auch ohne Anmeldung)
CREATE POLICY "Jeder kann Matches sehen" 
ON public.matches FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy für Matches: Nur Admin kann Matches erstellen
CREATE POLICY "Nur Admin kann Matches erstellen" 
ON public.matches FOR INSERT 
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Matches: Nur Admin kann Matches aktualisieren
CREATE POLICY "Nur Admin kann Matches aktualisieren" 
ON public.matches FOR UPDATE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Matches: Nur Admin kann Matches löschen
CREATE POLICY "Nur Admin kann Matches löschen" 
ON public.matches FOR DELETE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policies für Spielpläne
-- Policy für Spielpläne: Jeder kann Spielpläne sehen
CREATE POLICY "Jeder kann Spielpläne sehen" 
ON public.schedules FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy für Spielpläne: Authentifizierte Benutzer können Spielpläne erstellen
CREATE POLICY "Authentifizierte Benutzer können Spielpläne erstellen" 
ON public.schedules FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Policy für Spielpläne: Ersteller und Admins können Spielpläne aktualisieren
CREATE POLICY "Ersteller und Admins können Spielpläne aktualisieren" 
ON public.schedules FOR UPDATE 
TO authenticated
USING (
    auth.uid() = created_by OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Spielpläne: Ersteller und Admins können Spielpläne löschen
CREATE POLICY "Ersteller und Admins können Spielpläne löschen" 
ON public.schedules FOR DELETE 
TO authenticated
USING (
    auth.uid() = created_by OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policies für Spielplan-Matches
-- Policy für Spielplan-Matches: Jeder kann Spielplan-Matches sehen
CREATE POLICY "Jeder kann Spielplan-Matches sehen" 
ON public.schedule_matches FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy für Spielplan-Matches: Authentifizierte Benutzer können Spielplan-Matches erstellen
CREATE POLICY "Authentifizierte Benutzer können Spielplan-Matches erstellen" 
ON public.schedule_matches FOR INSERT 
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.schedules
        WHERE id = schedule_id AND created_by = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Spielplan-Matches: Ersteller und Admins können Spielplan-Matches aktualisieren
CREATE POLICY "Ersteller und Admins können Spielplan-Matches aktualisieren" 
ON public.schedule_matches FOR UPDATE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.schedules
        WHERE id = schedule_id AND created_by = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Spielplan-Matches: Ersteller und Admins können Spielplan-Matches löschen
CREATE POLICY "Ersteller und Admins können Spielplan-Matches löschen" 
ON public.schedule_matches FOR DELETE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.schedules
        WHERE id = schedule_id AND created_by = auth.uid()
    ) OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- Policy für Games: Jeder kann Games sehen
CREATE POLICY "Jeder kann Games sehen" 
ON public.games FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy für Games: Authentifizierte Benutzer können Games erstellen
CREATE POLICY "Authentifizierte Benutzer können Games erstellen" 
ON public.games FOR INSERT 
TO authenticated
WITH CHECK (
    auth.uid() = player1_id OR auth.uid() = player2_id
);

-- Policy für Games: Teilnehmer können Games aktualisieren
CREATE POLICY "Teilnehmer können Games aktualisieren" 
ON public.games FOR UPDATE 
TO authenticated
USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
);

-- Policy für Games: Teilnehmer können Games löschen
CREATE POLICY "Teilnehmer können Games löschen" 
ON public.games FOR DELETE 
TO authenticated
USING (
    auth.uid() = player1_id OR auth.uid() = player2_id
);

-- Policy für Scores: Jeder kann Scores sehen
CREATE POLICY "Jeder kann Scores sehen" 
ON public.scores FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy für Scores: Teilnehmer können Scores erstellen
CREATE POLICY "Teilnehmer können Scores erstellen" 
ON public.scores FOR INSERT 
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.games
        WHERE id = game_id AND (player1_id = auth.uid() OR player2_id = auth.uid())
    )
);

-- Policy für Scores: Teilnehmer können Scores löschen
CREATE POLICY "Teilnehmer können Scores löschen" 
ON public.scores FOR DELETE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.games
        WHERE id = game_id AND (player1_id = auth.uid() OR player2_id = auth.uid())
    )
);
```

## 3. Umgebungsvariablen einrichten

Stelle sicher, dass die folgenden Umgebungsvariablen in deiner `.env.local`-Datei konfiguriert sind:

```
NEXT_PUBLIC_SUPABASE_URL=https://deine-projekt-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GLOBAL_ACCESS_CODE=squash2025
SUPABASE_SERVICE_ROLE_KEY=dein-service-role-key
```

1. `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Diese findest du in den API-Einstellungen deines Supabase-Projekts.
2. `NEXT_PUBLIC_SITE_URL`: Die URL deiner App im Entwicklungs- oder Produktionsmodus.
3. `NEXT_PUBLIC_GLOBAL_ACCESS_CODE`: Der globale Zugangscode, den alle Benutzer für die Anmeldung verwenden.
4. `SUPABASE_SERVICE_ROLE_KEY`: Du findest diesen in den API-Einstellungen deines Supabase-Projekts unter "Service Role Key". **ACHTUNG**: Dieser Schlüssel gibt vollen Zugriff auf die Datenbank und sollte nur auf dem Server verwendet werden.

## 4. Erster Admin-Benutzer

Wenn du die App zum ersten Mal verwendest, musst du einen Admin-Benutzer erstellen. Führe dazu folgenden SQL-Befehl in der Supabase-SQL-Konsole aus, nachdem du dich zum ersten Mal registriert hast:

```sql
UPDATE public.profiles 
SET role = 'admin'
WHERE id = 'deine-benutzer-id';
```

Ersetze `deine-benutzer-id` durch die ID des Benutzers, den du zum Admin machen möchtest.