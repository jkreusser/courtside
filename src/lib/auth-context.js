'use client';

// Diese Datei ist nur eine Weiterleitung zur neuen auth-provider.js-Implementierung
// Sie dient der schrittweisen Migration und kann später entfernt werden

import { useAuth, AuthProvider } from './auth-provider';

// Re-exportiere die Provider-Komponenten, damit vorhandener Code weiterhin funktioniert
export { useAuth, AuthProvider };

// Für die Abwärtskompatibilität
const authContext = { useAuth, AuthProvider };
export default authContext; 