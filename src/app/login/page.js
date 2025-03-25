'use client';

import { useState } from 'react';
import { signInWithAccessCode, createUserWithAccessCode } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [name, setName] = useState('');
    const [isNewUser, setIsNewUser] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingState, setLoadingState] = useState('');

    const handleSignIn = async (e) => {
        e.preventDefault();

        if (!email) {
            toast.error('Bitte gib deine E-Mail-Adresse ein');
            return;
        }

        if (!accessCode) {
            toast.error('Bitte gib den Zugangscode ein');
            return;
        }

        // Für neue Benutzer: Name prüfen
        if (isNewUser && !name) {
            toast.error('Bitte gib deinen Namen ein');
            return;
        }

        try {
            setIsLoading(true);
            setLoadingState('Überprüfe Anmeldedaten...');

            // Wenn es ein neuer Benutzer ist, erstellen wir direkt einen Account
            if (isNewUser) {
                setLoadingState('Erstelle neuen Benutzer...');

                const { data, error } = await createUserWithAccessCode(
                    email,
                    name,
                    accessCode,
                    'player'
                );

                if (error) {
                    setLoadingState('Fehler bei der Registrierung');
                    console.error('Registrierungsfehler:', error);

                    if (error.message?.includes('Zugangscode ist nicht korrekt')) {
                        toast.error('Der eingegebene Zugangscode ist nicht korrekt.');
                    } else if (error.message?.includes('User already registered')) {
                        toast.error('Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich stattdessen an.');
                        setIsNewUser(false);
                    } else {
                        toast.error(error.message || 'Registrierung fehlgeschlagen');
                    }
                    return;
                }

                if (data) {
                    setLoadingState('Registrierung erfolgreich!');
                    toast.success('Account erfolgreich erstellt!');
                    router.push('/');
                }
            } else {
                // Bestehender Benutzer versucht sich anzumelden
                setLoadingState('Anmeldung läuft...');

                const { data, error } = await signInWithAccessCode(email, accessCode);

                if (error) {
                    console.error('Anmeldefehler:', error);
                    setLoadingState('Anmeldefehler');

                    if (error.name === 'UserNotFound') {
                        setIsNewUser(true);
                        if (!name) {
                            const defaultName = email.split('@')[0];
                            setName(defaultName);
                        }
                        toast.success('Benutzer nicht gefunden. Bitte gib deinen Namen ein, um einen neuen Account zu erstellen.');
                    } else if (error.message?.includes('Zugangscode ist nicht korrekt')) {
                        toast.error('Der eingegebene Zugangscode ist nicht korrekt.');
                    } else {
                        toast.error(error.message || 'Anmeldung fehlgeschlagen');
                    }
                    return;
                }

                if (data) {
                    setLoadingState('Anmeldung erfolgreich!');
                    toast.success('Erfolgreich angemeldet!');
                    router.push('/');
                }
            }
        } catch (error) {
            console.error('Unerwarteter Fehler:', error);
            setLoadingState('Fehler');
            toast.error('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später erneut.');
        } finally {
            if (!isNewUser) {
                setIsLoading(false);
                setLoadingState('');
            }
        }
    };

    return (
        <div className="max-w-md mx-auto">
            <Card>
                <CardHeader className="border-b border-zinc-800">
                    <CardTitle className="text-white">Anmelden</CardTitle>
                    <CardDescription>
                        Melde dich mit deiner E-Mail und dem Zugangscode an.
                    </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSignIn} className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor="email" className="block text-sm font-medium">
                                E-Mail
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="deine@email.de"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading}
                                required
                                className="focus:border-primary focus:ring-primary"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="accessCode" className="block text-sm font-medium">
                                Zugangscode
                            </label>
                            <Input
                                id="accessCode"
                                type="password"
                                placeholder="Zugangscode"
                                value={accessCode}
                                onChange={(e) => setAccessCode(e.target.value)}
                                disabled={isLoading}
                                required
                                className="focus:border-primary focus:ring-primary"
                            />
                        </div>

                        {isNewUser && (
                            <div className="space-y-2">
                                <label htmlFor="name" className="block text-sm font-medium">
                                    Dein Name
                                </label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="Max Mustermann"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    disabled={isLoading}
                                    required
                                    className="focus:border-primary focus:ring-primary"
                                />
                                <p className="text-sm text-zinc-400 mt-1">
                                    Da wir dich nicht kennen, erstellen wir einen neuen Account für dich.
                                </p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full mt-6"
                            disabled={isLoading}
                        >
                            {isLoading ? (loadingState || 'Wird angemeldet...') : isNewUser ? 'Account erstellen' : 'Anmelden'}
                        </Button>

                        {loadingState && (
                            <div className="text-center text-sm text-primary mt-2 font-medium">
                                Status: {loadingState}
                            </div>
                        )}
                    </form>
                </CardContent>
                <CardFooter className="text-center text-sm text-zinc-400 border-t border-zinc-800 py-4">
                    <p className="mx-auto">
                        Gib den Zugangscode ein, den du von deinem Teamleiter erhalten hast.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
} 