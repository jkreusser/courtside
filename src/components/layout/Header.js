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
        { name: 'Dashboard', href: '/' },
        { name: 'Spiele', href: '/games' },
        { name: 'Ranglisten', href: '/rankings' },
        { name: 'Achievements', href: '/achievements' },
    ];

    if (isAdmin) {
        navItems.push({ name: 'Admin', href: '/admin' });
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
                                    'px-3 py-2 rounded-md text-sm font-medium',
                                    pathname === item.href
                                        ? 'bg-secondary text-primary'
                                        : 'text-zinc-300 hover:bg-zinc-800'
                                )}
                            >
                                {item.name}
                            </Link>
                        ))}

                        {user ? (
                            <a
                                onClick={handleSignOut}
                                className="ml-2 px-0 py-2 rounded-md text-sm font-medium text-zinc-300 hover:bg-zinc-800 cursor-pointer"
                            >
                                Abmelden
                            </a>
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
                                    {item.name}
                                </Link>
                            ))}

                            {user ? (
                                <a
                                    onClick={() => {
                                        handleSignOut();
                                        handleMenuToggle();
                                    }}
                                    className="px-3 py-2 rounded-md text-sm font-medium text-zinc-300 hover:bg-zinc-800 text-left mobile-menu-item cursor-pointer block"
                                    style={{ animationDelay: `${0.05 * (navItems.length + 1)}s` }}
                                >
                                    Abmelden
                                </a>
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