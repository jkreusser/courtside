ALTER TABLE games ADD COLUMN sets_to_win INTEGER NOT NULL DEFAULT 3;
COMMENT ON COLUMN games.sets_to_win IS 'Anzahl der Sätze, die ein Spieler gewinnen muss (1=Best of 1, 2=Best of 3, 3=Best of 5)';
