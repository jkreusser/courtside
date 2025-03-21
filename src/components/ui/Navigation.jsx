"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import Button from "./Button";

export default function Navigation() {
  const { user, isAdmin, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="font-bold text-xl">
                <span className="text-white">Court</span>
                <span className="text-primary">Side</span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/"
                className="border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white hover:border-zinc-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Dashboard
              </Link>

              <Link
                href="/games"
                className="border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white hover:border-zinc-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Spiele
              </Link>

              {isAdmin && (
                <Link
                  href="/admin"
                  className="border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white hover:border-zinc-300 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {user ? (
              <div className="flex items-center space-x-4">
                <Link
                  href="/profile"
                  className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-white"
                >
                  Profil
                </Link>
                <Button onClick={signOut} variant="secondary" size="sm">
                  Abmelden
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="primary" size="sm">
                  Anmelden
                </Button>
              </Link>
            )}
          </div>
          <div className="-mr-2 flex items-center sm:hidden">
            <button
              onClick={toggleMenu}
              className="bg-white dark:bg-zinc-900 inline-flex items-center justify-center p-2 rounded-md text-zinc-400 dark:text-zinc-500 hover:text-zinc-500 dark:hover:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">Menü öffnen</span>
              {isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {isMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            <Link
              href="/"
              className="bg-zinc-50 dark:bg-zinc-800 border-zinc-500 text-zinc-700 dark:text-white block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>

            <Link
              href="/games"
              className="border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-white block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Spiele
            </Link>

            {isAdmin && (
              <Link
                href="/admin"
                className="border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-white block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                Admin
              </Link>
            )}
          </div>

          <div className="pt-4 pb-3 border-t border-zinc-200 dark:border-zinc-800">
            {user ? (
              <div className="space-y-1">
                <Link
                  href="/profile"
                  className="border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-white block pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profil
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    setIsMenuOpen(false);
                  }}
                  className="border-transparent text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-white block w-full text-left pl-3 pr-4 py-2 border-l-4 text-base font-medium"
                >
                  Abmelden
                </button>
              </div>
            ) : (
              <div className="px-2">
                <Link
                  href="/login"
                  className="block w-full text-center px-4 py-2 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-blue-600 hover:bg-blue-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Anmelden
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
