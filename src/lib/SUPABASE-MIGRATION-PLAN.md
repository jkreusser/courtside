# Migrationsplan: Vereinfachte Supabase-Integration

Dieser Plan beschreibt die schrittweise Migration von der komplexen Supabase-Integration zur vereinfachten Version, um Timeout-Probleme zu beheben und die Codebase zu optimieren.

## Übersicht der Änderungen

1. **Middleware.js**: Aktualisierung mit Timeout-Handling (✅ Bereits erledigt)
2. **Homepage**: Teilweise Migration (✅ Bereits begonnen)
3. **Restliche Komponenten**: Noch zu migrieren (🔄 In Bearbeitung)

## Änderungen im Detail

### Phase 1: Vorbereitungen

1. **SQL-Timeouts anpassen**: Die Datei `supabase-server-timeout-fix.sql` im Supabase SQL Editor ausführen:
   ```sql
   -- Anon-Rolle auf 30 Sekunden setzen (von 3 Sekunden)
   ALTER ROLE anon SET statement_timeout = '30s';
   
   -- Authenticated-Rolle auf 60 Sekunden setzen (von 8 Sekunden)
   ALTER ROLE authenticated SET statement_timeout = '60s';
   
   -- Service-Rolle explizit konfigurieren
   ALTER ROLE service_role SET statement_timeout = '90s';
   
   -- Nach den Änderungen die Konfiguration neu laden
   NOTIFY pgrst, 'reload config';
   ```

2. **Umgebungsvariablen prüfen**:
   - `NEXT_PUBLIC_USE_DIRECT_CONNECTION=true` (bereits in .env.local gesetzt)
   - `NEXT_PUBLIC_SUPABASE_DIRECT_URL=https://[PROJEKT-ID].supabase.co`

### Phase 2: Code-Migration

#### Für jede Datei, die den alten Supabase-Client verwendet:

1. **Imports anpassen**:
   ```javascript
   // Alt
   import { supabase, ... } from '@/lib/supabase';
   
   // Neu
   import { supabase, ... } from '@/lib/supabase-client';
   ```

2. **Verbindungsprüfungen aktualisieren**:
   ```javascript
   // Alt
   ensureSupabaseConnection();
   resetConnectionState();
   
   // Neu 
   checkConnection();
   ```

3. **Optimierte Funktionen**:
   ```javascript
   // Alt
   const { data, error } = await getPlayers();
   
   // Neu
   const { data, error } = await supabase.from('players').select('*');
   ```

4. **Tab-Visibility integrieren** (für clientseitige Komponenten):
   ```javascript
   import { useTabVisibility, smartFetch } from '@/lib/tab-visibility-helper';
   
   // In der Komponente
   const isTabVisible = useTabVisibility();
   
   // Bei datenintensiven Operationen
   useEffect(() => {
     if (isTabVisible) {
       fetchData();
     }
   }, [isTabVisible]);
   ```

#### Für serverseitige Komponenten:

1. **Imports anpassen**:
   ```javascript
   // Alt
   import { supabaseAdmin } from '@/lib/supabase';
   
   // Neu
   import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase-server';
   ```

2. **Serverseitigen Client verwenden**:
   ```javascript
   // Alt
   export async function SomeServerComponent() {
     const { data } = await supabaseAdmin.from('players').select('*');
     // ...
   }
   
   // Neu
   export async function SomeServerComponent() {
     const supabase = await createSupabaseServerClient();
     const { data } = await supabase.from('players').select('*');
     // ...
   }
   ```

3. **Für Admin-Operationen**:
   ```javascript
   // Alt
   const { data } = await supabaseAdmin.from('players').select('*');
   
   // Neu
   const adminClient = await createAdminClient();
   const { data } = await adminClient.from('players').select('*');
   ```

4. **Auth-Checks in geschützten Routen**:
   ```javascript
   // Alt
   const { data: { session } } = await supabase.auth.getSession();
   if (!session) { /* redirect */ }
   
   // Neu
   const session = await requireAuth('/login');
   // Wenn die Funktion zurückkehrt, ist der Benutzer authentifiziert
   ```

### Phase 3: Auth-Context aktualisieren

Der Auth-Context sollte von `auth-context.js` auf die neuen Client-Funktionen umgestellt werden:

```javascript
// Alter Auth-Context verwendet komplexe Logik
// Neuer Auth-Context sollte einfacher sein und die Funktionen aus supabase-client.js verwenden
```

### Phase 4: Dateien bereinigen

Nach erfolgreicher Migration können folgende Dateien gelöscht werden:

- `src/lib/supabase.js`
- `src/lib/supabase-direct-connection.js`
- `src/lib/check-connection.js`
- `src/lib/auth-context.js` (nach Migration des Auth-Contexts)

## Migrationsreihenfolge

1. Zuerst die serverseitigen Komponenten migrieren
2. Dann die clientseitigen Komponenten, die am häufigsten genutzt werden
3. Zuletzt den Auth-Context und verbleibende Komponenten

## Testen

Bei jeder migrierten Komponente:

1. Prüfen, ob alle Funktionen noch korrekt arbeiten
2. Tab-Wechsel testen, um sicherzustellen, dass keine Timeouts auftreten
3. Netzwerkprobleme simulieren, um die Fehlerbehandlung zu testen

## Fertigstellungskriterien

Die Migration ist abgeschlossen, wenn:

1. Alle Komponenten die neuen Client-Dateien verwenden
2. Die alten Dateien gelöscht wurden
3. Keine Timeout-Probleme mehr auftreten
4. Die Anwendung auch bei schlechter Netzwerkverbindung stabil läuft

Mit dieser strukturierten Migration verbessern wir die Stabilität der Anwendung erheblich und reduzieren gleichzeitig den Wartungsaufwand durch die Vereinfachung des Codes. 