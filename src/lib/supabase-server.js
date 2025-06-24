import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Erstellt einen serverseitigen Supabase-Client mit Cookie-Authentifizierung
 * Für Server Components und Server Actions
 */
export async function createSupabaseServerClient() {
    const cookieStore = cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get(name) {
                    return cookieStore.get(name)?.value;
                },
                set(name, value, options) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name, options) {
                    cookieStore.set({ name, value: '', ...options, maxAge: 0 });
                },
            },
        }
    );
}

/**
 * Server-Client mit Admin-Rechten für administrative Aufgaben
 * Sicher nur auf dem Server verwenden!
 */
export async function createAdminClient() {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            cookies: {
                get(name) {
                    return undefined;
                },
                set(name, value, options) {
                    // Nichts tun
                },
                remove(name, options) {
                    // Nichts tun
                },
            },
        }
    );
}

/**
 * Einfacher Auth-Middleware-Handler für geschützte Routen
 * Leitet bei fehlender Authentifizierung zur Login-Seite weiter
 */
export async function requireAuth(redirectTo = '/login') {
    const supabase = await createSupabaseServerClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        // Bei fehlender Authentifizierung zur Login-Seite weiterleiten
        const url = new URL(redirectTo, process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
        return Response.redirect(url);
    }

    return session;
}

/**
 * Helper-Funktion zur serverseitigen Admin-Überprüfung
 */
export async function checkAdmin() {
    const supabase = await createSupabaseServerClient();

    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        return false;
    }

    const { data } = await supabase
        .from('players')
        .select('role')
        .eq('id', session.user.id)
        .single();

    return data?.role === 'admin';
} 