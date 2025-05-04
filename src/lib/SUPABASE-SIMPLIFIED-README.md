# Vereinfachte Supabase-Integration

Diese README erklärt die neue, vereinfachte Supabase-Integration, die redundante Dateien und Code aus dem Projekt entfernt.

## Neue Dateien

Die Integration besteht aus zwei Hauptdateien:

1. **`supabase-client.js`** - Client-seitige Supabase-Integration für Browser-Komponenten
2. **`supabase-server.js`** - Server-seitige Supabase-Integration für Server-Komponenten und API-Routes

Diese Dateien ersetzen mehrere vorhandene Dateien mit redundantem Code.

## Zu löschende Dateien

Nach der Implementierung der neuen Dateien können folgende Dateien gelöscht werden:

- `supabase.js` (ersetzt durch die neuen Dateien)
- `supabase-direct-connection.js` (in die neuen Dateien integriert)
- `check-connection.js` (vereinfacht in supabase-client.js)
- `tab-visibility-helper.js` (nicht mehr notwendig für Verbindungsmanagement)
- `README-direct-connection.md` (in diese README integriert)
- `auth-context.js` (vereinfacht in neue Auth-Provider-Implementierung)

## Timeout-Optimierungen

Diese Integration enthält bereits die nötigen Timeout-Optimierungen:

1. **Serverseitige Timeouts**: Die serverseitigen SQL-Befehle aus der Datei `supabase-server-timeout-fix.sql` sollten weiterhin ausgeführt werden.

2. **Direkte Verbindung**: Die Konfiguration für die direkte Verbindung ist in den neuen Dateien integriert und kann mit denselben Umgebungsvariablen gesteuert werden:

```
NEXT_PUBLIC_USE_DIRECT_CONNECTION=true
NEXT_PUBLIC_SUPABASE_DIRECT_URL=https://[PROJEKT-ID].supabase.co
```

3. **Verbesserte Browser-Kompatibilität**: Die neuen Dateien verwenden Cookie-basierte Authentifizierung statt localStorage, was besser mit Browser-Einschränkungen wie ITP umgeht.

## Verwendung

### Client-Komponenten

```jsx
'use client';

import { supabase, getCurrentUser, signOut } from "@/lib/supabase-client";

export default function ClientComponent() {
  const handleLogout = async () => {
    await signOut();
    // ...
  };

  // Daten abrufen
  const fetchData = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*');
    // ...
  };

  return (
    // ...
  );
}
```

### Server-Komponenten

```jsx
import { createSupabaseServerClient } from "@/lib/supabase-server";

export default async function ServerComponent() {
  const supabase = await createSupabaseServerClient();
  
  // Daten abrufen
  const { data } = await supabase.from('players').select('*');
  
  return (
    <div>
      {data.map(player => (
        <div key={player.id}>{player.name}</div>
      ))}
    </div>
  );
}
```

### Geschützte Routen

```jsx
import { requireAuth } from "@/lib/supabase-server";

export default async function ProtectedPage() {
  const session = await requireAuth('/login');
  
  return (
    <div>
      <h1>Geschützte Seite</h1>
      <p>Willkommen {session.user.email}!</p>
    </div>
  );
}
```

## Migration

Um auf die neue Integration umzusteigen:

1. Erstelle die beiden neuen Dateien
2. Aktualisiere vorhandene Komponenten, um die neuen Importpfade zu verwenden
3. Lösche die alten, redundanten Dateien 

Dadurch wird die Codebasis sauberer, die Wartbarkeit verbessert und Duplizierungen vermieden. 