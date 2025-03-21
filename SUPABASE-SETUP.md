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

-- Rankings-Funktionen
CREATE OR REPLACE FUNCTION get_all_time_rankings()
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    games_played INTEGER,
    games_won INTEGER,
    win_percentage NUMERIC,
    last_played TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH matches_data AS (
        SELECT
            p.id as player_id,
            p.name as player_name,
            COUNT(*) as games_played,
            SUM(CASE 
                WHEN m.player1_id = p.id AND m.score_player1 > m.score_player2 THEN 1
                WHEN m.player2_id = p.id AND m.score_player2 > m.score_player1 THEN 1
                ELSE 0
            END) as games_won,
            MAX(m.created_at) as last_played
        FROM
            players p
        LEFT JOIN (
            SELECT * FROM matches 
            UNION ALL
            SELECT 
                id, 
                player2_id as player1_id, 
                player1_id as player2_id, 
                score_player2 as score_player1, 
                score_player1 as score_player2,
                game_date,
                created_at,
                created_by
            FROM matches
        ) m ON p.id = m.player1_id
        GROUP BY p.id, p.name
    )
    SELECT
        md.player_id,
        md.player_name,
        md.games_played,
        md.games_won,
        CASE WHEN md.games_played > 0 THEN (md.games_won::NUMERIC / md.games_played) * 100 ELSE 0 END as win_percentage,
        md.last_played
    FROM
        matches_data md
    ORDER BY
        win_percentage DESC, games_played DESC, player_name ASC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_daily_rankings(target_date DATE)
RETURNS TABLE (
    player_id UUID,
    player_name TEXT,
    games_played INTEGER,
    games_won INTEGER,
    win_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH matches_data AS (
        SELECT
            p.id as player_id,
            p.name as player_name,
            COUNT(*) as games_played,
            SUM(CASE 
                WHEN m.player1_id = p.id AND m.score_player1 > m.score_player2 THEN 1
                WHEN m.player2_id = p.id AND m.score_player2 > m.score_player1 THEN 1
                ELSE 0
            END) as games_won
        FROM
            players p
        LEFT JOIN (
            SELECT * FROM matches WHERE game_date = target_date
            UNION ALL
            SELECT 
                id, 
                player2_id as player1_id, 
                player1_id as player2_id, 
                score_player2 as score_player1, 
                score_player1 as score_player2,
                game_date,
                created_at,
                created_by
            FROM matches WHERE game_date = target_date
        ) m ON p.id = m.player1_id
        GROUP BY p.id, p.name
        HAVING COUNT(*) > 0
    )
    SELECT
        md.player_id,
        md.player_name,
        md.games_played,
        md.games_won,
        CASE WHEN md.games_played > 0 THEN (md.games_won::NUMERIC / md.games_played) * 100 ELSE 0 END as win_percentage
    FROM
        matches_data md
    ORDER BY
        win_percentage DESC, games_played DESC, player_name ASC;
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