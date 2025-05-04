-- Supabase Server-seitige Timeout-Optimierung
-- Führe dieses SQL-Script im Supabase SQL Editor aus

-- Anon-Rolle auf 30 Sekunden setzen (von 3 Sekunden)
ALTER ROLE anon SET statement_timeout = '30s';

-- Authenticated-Rolle auf 60 Sekunden setzen (von 8 Sekunden)
ALTER ROLE authenticated SET statement_timeout = '60s';

-- Service-Rolle explizit konfigurieren
ALTER ROLE service_role SET statement_timeout = '90s';

-- Nach den Änderungen die Konfiguration neu laden
NOTIFY pgrst, 'reload config';

-- Zum Überprüfen der aktuellen Timeouts:
SELECT rolname, rolconfig 
FROM pg_roles 
WHERE rolname IN ('anon', 'authenticated', 'service_role');

-- HINWEIS: Den folgenden Befehl SEPARAT ausführen!
-- ALTER SYSTEM muss außerhalb einer Transaktion ausgeführt werden.
-- Kopiere diesen Befehl und führe ihn in einem neuen SQL-Abfragefenster aus:
-- 
-- ALTER SYSTEM SET idle_in_transaction_session_timeout = '60s';
--
-- Oder führe den Befehl mit dem Flag COMMIT = OFF aus. 