import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function middleware(request) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get(name) {
                    return request.cookies.get(name)?.value;
                },
                set(name, value, options) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name, options) {
                    request.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    // Geschützte Routen
    const protectedRoutes = ['/admin', '/rankings/manage'];
    const adminRoutes = ['/admin'];
    const isProtectedRoute = protectedRoutes.some(route =>
        request.nextUrl.pathname.startsWith(route)
    );
    const isAdminRoute = adminRoutes.some(route =>
        request.nextUrl.pathname.startsWith(route)
    );

    // Benutzer überprüfen
    const { data: { session } } = await supabase.auth.getSession();

    // Überprüfen, ob der Benutzer Admin ist (für Admin-Routen)
    let isAdmin = false;
    if (session?.user) {
        const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        isAdmin = data?.role === 'admin';
    }

    // Weiterleitung, wenn der Benutzer nicht angemeldet ist und auf geschützte Route zugreift
    if (isProtectedRoute && !session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Weiterleitung, wenn der Benutzer kein Admin ist und auf Admin-Route zugreift
    if (isAdminRoute && (!session || !isAdmin)) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
}

// Middleware nur für bestimmte Routen ausführen
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|api/auth|auth/callback).*)',
    ],
}; 