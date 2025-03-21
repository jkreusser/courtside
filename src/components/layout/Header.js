'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { signOut } from '@/lib/supabase';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { useState, useEffect } from 'react';

export default function Header() {
    const { user, isAdmin } = useAuth();
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Behandle die Schließanimation
    const handleMenuToggle = () => {
        if (mobileMenuOpen) {
            // Animation beim Schließen
            setIsAnimating(true);
            setTimeout(() => {
                setMobileMenuOpen(false);
                setIsAnimating(false);
            }, 200);
        } else {
            // Sofort öffnen
            setMobileMenuOpen(true);
        }
    };

    // Schließe das Menü beim Seitenwechsel
    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    const handleSignOut = async () => {
        const { error } = await signOut();
        if (error) {
            toast.error('Fehler beim Abmelden');
        } else {
            toast.success('Erfolgreich abgemeldet');
        }
    };

    const navItems = [
        {
            name: 'Dashboard',
            href: '/',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
            )
        },
        {
            name: 'Spiele',
            href: '/games',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
            )
        },
        {
            name: 'Ranglisten',
            href: '/rankings',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
            )
        },
        {
            name: 'Achievements',
            href: '/achievements',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                </svg>
            )
        },
    ];

    if (isAdmin) {
        navItems.push({
            name: 'Admin',
            href: '/admin',
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            )
        });
    }

    return (
        <header className="bg-zinc-950 border-b border-zinc-800">
            <div className="container mx-auto px-4 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Link href="/" className="text-2xl font-bold">
                            <span className="text-white">Court</span><span className="text-primary">Side</span>
                        </Link>
                    </div>

                    {/* Mobile menu button mit Animation */}
                    <button
                        className="md:hidden p-2 rounded-md text-zinc-400 hover:text-zinc-500 hover:bg-zinc-800 transition-all duration-200"
                        onClick={handleMenuToggle}
                        aria-label={mobileMenuOpen ? "Menü schließen" : "Menü öffnen"}
                        aria-expanded={mobileMenuOpen}
                    >
                        <div className="relative w-6 h-6">
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                className={`h-6 w-6 absolute transition-all duration-200 transform ${mobileMenuOpen ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"}`}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 6h16M4 12h16M4 18h16"
                                />
                            </svg>
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                className={`h-6 w-6 absolute transition-all duration-200 transform ${mobileMenuOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-90 scale-50"}`}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </div>
                    </button>

                    {/* Desktop navigation */}
                    <nav className="hidden md:flex items-center space-x-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    'px-3 py-2 rounded-md text-sm font-medium flex items-center gap-2',
                                    pathname === item.href
                                        ? 'bg-secondary text-primary'
                                        : 'text-zinc-300 hover:bg-zinc-800'
                                )}
                            >
                                {item.icon}
                                {item.name}
                            </Link>
                        ))}

                        {user ? (
                            <>
                                <Link
                                    href="/profile"
                                    className={clsx(
                                        'p-2 rounded-md flex items-center justify-center',
                                        pathname === '/profile'
                                            ? 'bg-secondary text-primary'
                                            : 'text-zinc-300 hover:bg-zinc-800'
                                    )}
                                    title="Profil"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                                        />
                                    </svg>
                                </Link>
                                <a
                                    onClick={handleSignOut}
                                    className="p-2 rounded-md text-zinc-300 hover:bg-zinc-800 cursor-pointer flex items-center justify-center"
                                    title="Abmelden"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={1.5}
                                        stroke="currentColor"
                                        className="w-5 h-5"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                                        />
                                    </svg>
                                </a>
                            </>
                        ) : (
                            <Link
                                href="/login"
                                className="ml-2 px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-zinc-800"
                            >
                                Anmelden
                            </Link>
                        )}
                    </nav>
                </div>

                {/* Mobile navigation mit Animation */}
                {(mobileMenuOpen || isAnimating) && (
                    <nav
                        className={`mt-4 border-t border-zinc-700 pt-4 md:hidden mobile-menu-enter overflow-hidden transition-all duration-200 ${isAnimating ? 'opacity-0 max-h-0' : 'opacity-100 max-h-screen'}`}
                    >
                        <div className="flex flex-col space-y-2">
                            {navItems.map((item, index) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={clsx(
                                        'px-3 py-2 rounded-md text-sm font-medium block mobile-menu-item',
                                        pathname === item.href
                                            ? 'bg-secondary text-primary'
                                            : 'text-zinc-300 hover:bg-zinc-800'
                                    )}
                                    onClick={handleMenuToggle}
                                    style={{ animationDelay: `${0.05 * (index + 1)}s` }}
                                >
                                    <div className="flex items-center gap-2">
                                        {item.icon}
                                        {item.name}
                                    </div>
                                </Link>
                            ))}

                            {user ? (
                                <>
                                    <Link
                                        href="/profile"
                                        className={clsx(
                                            'px-3 py-2 rounded-md text-sm font-medium block mobile-menu-item',
                                            pathname === '/profile'
                                                ? 'bg-secondary text-primary'
                                                : 'text-zinc-300 hover:bg-zinc-800'
                                        )}
                                        onClick={handleMenuToggle}
                                        style={{ animationDelay: `${0.05 * (navItems.length + 1)}s` }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={1.5}
                                                stroke="currentColor"
                                                className="w-5 h-5"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
                                                />
                                            </svg>
                                            Profil
                                        </div>
                                    </Link>
                                    <a
                                        onClick={() => {
                                            handleSignOut();
                                            handleMenuToggle();
                                        }}
                                        className="px-3 py-2 rounded-md text-sm font-medium text-zinc-300 hover:bg-zinc-800 text-left mobile-menu-item cursor-pointer block"
                                        style={{ animationDelay: `${0.05 * (navItems.length + 2)}s` }}
                                    >
                                        <div className="flex items-center gap-2">
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                strokeWidth={1.5}
                                                stroke="currentColor"
                                                className="w-5 h-5"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                                                />
                                            </svg>
                                            Abmelden
                                        </div>
                                    </a>
                                </>
                            ) : (
                                <Link
                                    href="/login"
                                    className="px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-zinc-800 block mobile-menu-item"
                                    onClick={handleMenuToggle}
                                    style={{ animationDelay: `${0.05 * (navItems.length + 1)}s` }}
                                >
                                    Anmelden
                                </Link>
                            )}
                        </div>
                    </nav>
                )}
            </div>
        </header>
    );
} 