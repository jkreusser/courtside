# E-Mail-Bestätigung in Supabase deaktivieren

Um die Registrierung ohne E-Mail-Bestätigung zu ermöglichen, müssen die Supabase-Authentifizierungseinstellungen angepasst werden.

## Methode 1: Über die Supabase Admin-UI

1. Öffne dein Supabase-Projekt im Browser
2. Gehe zu "Authentication" → "Providers" → "Email" im linken Menü
3. Deaktiviere die Option "Confirm Email" (E-Mail bestätigen)
4. Klicke auf "Save" (Speichern), um die Änderungen zu übernehmen

![Deaktivierung der E-Mail-Bestätigung](https://i.imgur.com/example.png)

## Methode 2: Über SQL (für bestehende Benutzer)

Für bestehende Benutzer, deren E-Mail noch nicht bestätigt ist, verwende das SQL-Skript:

1. Öffne dein Supabase-Projekt
2. Gehe zum SQL-Editor
3. Führe folgende Befehle aus:

```sql
-- Benutzer aufführen, die noch nicht bestätigt sind
SELECT * FROM auth.users WHERE confirmed_at IS NULL;

-- E-Mail-Bestätigung für alle Benutzer markieren
UPDATE auth.users SET confirmed_at = NOW() WHERE confirmed_at IS NULL;

-- Supabase Authentifizierung so konfigurieren, dass keine E-Mail-Bestätigung erforderlich ist
UPDATE auth.config SET value = 'false' WHERE key = 'ENABLE_EMAIL_CONFIRMATION';
```

## Methode 3: Direkt im Code (wie bereits implementiert)

In deiner `src/lib/supabase.js` wurde bereits die Option `emailConfirm: false` hinzugefügt, um die E-Mail-Bestätigung zu deaktivieren:

```javascript
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
```

Diese Einstellung sollte für neue Benutzer funktionieren, aber sie könnte von den globalen Einstellungen in der Supabase-Konfiguration überschrieben werden. Daher ist es am besten, auch die Admin-UI-Einstellungen zu ändern.

## Wichtiger Hinweis

Die Deaktivierung der E-Mail-Bestätigung kann Sicherheitsrisiken mit sich bringen. In einer Produktionsumgebung empfiehlt es sich, die E-Mail-Bestätigung zu aktivieren und zu gewährleisten, dass Benutzer wirklich auf ihre E-Mail-Adresse zugreifen können.

Für eine Entwicklungs- oder Testumgebung oder für eine App, die nur intern genutzt wird, kann die Deaktivierung der E-Mail-Bestätigung jedoch die Benutzerfreundlichkeit verbessern. 