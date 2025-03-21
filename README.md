# Squash-App

Eine webbasierte Anwendung zur Organisation von Squash-Spielen, Verwaltung von Spielpaarungen, Ergebnissen und Rankings.

## Funktionen

- **Automatische Spielpaarungsgenerierung:** Erstellt automatisch ausgeglichene Spielpaarungen basierend auf der Anzahl der Spieler und verfügbaren Courts
- **Court-Management:** Erlaubt die Eingabe, wie viele Courts verfügbar sind
- **Ergebnis-Tracking:** Spieler können Ergebnisse nach jedem Match eintragen
- **Ranglisten:** All-Time-Rangliste und tägliche Rankings
- **Achievements/Badges:** Belohnungen für Meilensteine
- **Authentifizierung & Zugriffskontrolle:** Manuelle Nutzerverwaltung, Magische Links für passwortlose Anmeldung

## Technologien

- **Frontend:** React, Next.js, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth)
- **State Management:** React Hooks, Context API, Zustand
- **Styling:** Tailwind CSS, clsx für bedingte Klassenkomposition

## Installation

### Voraussetzungen

- Node.js (v14 oder höher)
- npm oder yarn
- Supabase-Konto (für Datenbank und Authentifizierung)

### Setup

1. Repository klonen:
   ```bash
   git clone https://github.com/yourusername/squash-app.git
   cd squash-app
   ```

2. Abhängigkeiten installieren:
   ```bash
   npm install
   # oder
   yarn install
   ```

3. Supabase-Projekt einrichten:
   - Erstelle ein neues Projekt auf [supabase.com](https://supabase.com)
   - Kopiere die Projekt-URL und den anonymen Schlüssel

4. Umgebungsvariablen konfigurieren:
   - Erstelle eine `.env.local` Datei im Projektstamm
   - Füge folgende Variablen hinzu:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://deine-projekt-id.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=dein-anonymer-schlüssel
     NEXT_PUBLIC_SITE_URL=http://localhost:3000
     ```

5. Datenbank-Schema einrichten:
   - Erstelle folgende Tabellen in deinem Supabase-Projekt:
     - `players` (id, name, email, created_at)
     - `matches` (id, player1_id, player2_id, score_player1, score_player2, court_number, date, is_complete, created_at)
     - `profiles` (id, role, created_at)
     - `player_achievements` (id, player_id, achievement_id, achieved_at)
   - Erstelle entsprechende RLS-Richtlinien (Row Level Security)
   - Implementiere die SQL-Funktionen für Ranglisten (`get_all_time_rankings`, `get_daily_rankings`)

6. Entwicklungsserver starten:
   ```bash
   npm run dev
   # oder
   yarn dev
   ```

7. Die Anwendung ist nun unter [http://localhost:3000](http://localhost:3000) verfügbar.

## Datenbankschema

### players
- `id` (uuid, primary key, references auth.users)
- `name` (text)
- `email` (text, unique)
- `created_at` (timestamp with time zone, default: now())

### matches
- `id` (uuid, primary key)
- `player1_id` (uuid, references players.id)
- `player2_id` (uuid, references players.id)
- `score_player1` (integer, nullable)
- `score_player2` (integer, nullable)
- `court_number` (integer)
- `date` (date)
- `is_complete` (boolean, default: false)
- `created_at` (timestamp with time zone, default: now())

### profiles
- `id` (uuid, primary key, references auth.users)
- `role` (text, default: 'player')
- `created_at` (timestamp with time zone, default: now())

### player_achievements
- `id` (uuid, primary key)
- `player_id` (uuid, references players.id)
- `achievement_id` (text)
- `achieved_at` (timestamp with time zone, default: now())

## SQL-Funktionen für Rankings

```sql
-- get_all_time_rankings
CREATE OR REPLACE FUNCTION get_all_time_rankings()
RETURNS TABLE (
  player_id uuid,
  player_name text,
  points bigint,
  matches_played bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH match_results AS (
    -- Spieler 1 Siege
    SELECT
      player1_id as player_id,
      CASE
        WHEN score_player1 > score_player2 THEN 3 -- Sieg = 3 Punkte
        WHEN score_player1 = score_player2 THEN 1 -- Unentschieden = 1 Punkt
        ELSE 0 -- Niederlage = 0 Punkte
      END as points,
      1 as matches_played
    FROM matches
    WHERE is_complete = true
    
    UNION ALL
    
    -- Spieler 2 Siege
    SELECT
      player2_id as player_id,
      CASE
        WHEN score_player2 > score_player1 THEN 3 -- Sieg = 3 Punkte
        WHEN score_player1 = score_player2 THEN 1 -- Unentschieden = 1 Punkt
        ELSE 0 -- Niederlage = 0 Punkte
      END as points,
      1 as matches_played
    FROM matches
    WHERE is_complete = true
  )
  
  SELECT
    p.id as player_id,
    p.name as player_name,
    COALESCE(SUM(mr.points), 0) as points,
    COALESCE(SUM(mr.matches_played), 0) as matches_played
  FROM players p
  LEFT JOIN match_results mr ON p.id = mr.player_id
  GROUP BY p.id, p.name
  ORDER BY points DESC, matches_played DESC;
END;
$$ LANGUAGE plpgsql;

-- get_daily_rankings
CREATE OR REPLACE FUNCTION get_daily_rankings(target_date date)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  points bigint,
  matches_played bigint
) AS $$
BEGIN
  RETURN QUERY
  WITH match_results AS (
    -- Spieler 1 Siege
    SELECT
      player1_id as player_id,
      CASE
        WHEN score_player1 > score_player2 THEN 3 -- Sieg = 3 Punkte
        WHEN score_player1 = score_player2 THEN 1 -- Unentschieden = 1 Punkt
        ELSE 0 -- Niederlage = 0 Punkte
      END as points,
      1 as matches_played
    FROM matches
    WHERE is_complete = true AND date = target_date
    
    UNION ALL
    
    -- Spieler 2 Siege
    SELECT
      player2_id as player_id,
      CASE
        WHEN score_player2 > score_player1 THEN 3 -- Sieg = 3 Punkte
        WHEN score_player1 = score_player2 THEN 1 -- Unentschieden = 1 Punkt
        ELSE 0 -- Niederlage = 0 Punkte
      END as points,
      1 as matches_played
    FROM matches
    WHERE is_complete = true AND date = target_date
  )
  
  SELECT
    p.id as player_id,
    p.name as player_name,
    COALESCE(SUM(mr.points), 0) as points,
    COALESCE(SUM(mr.matches_played), 0) as matches_played
  FROM players p
  LEFT JOIN match_results mr ON p.id = mr.player_id
  GROUP BY p.id, p.name
  ORDER BY points DESC, matches_played DESC;
END;
$$ LANGUAGE plpgsql;
```

## Lizenz

MIT
# courtside
