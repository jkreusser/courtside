'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProfile, updateProfile, updateAccessCode, signOut } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

// Komponente für den Ladeindikator
function LoadingIndicator({ message }) {
    return (
        <div className="flex justify-center items-center py-12">
            <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4"></div>
                <p className="text-zinc-500">{message}</p>
            </div>
        </div>
    );
}

// Komponente für Offline-Status
function OfflineIndicator() {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        setIsOnline(navigator.onLine);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    if (isOnline) return null;

    return (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 mb-6">
            <div className="flex items-center text-yellow-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Sie sind offline - einige Funktionen sind möglicherweise eingeschränkt</span>
            </div>
        </div>
    );
}

// Hauptkomponente für den Profilinhalt
function ProfileContent({ user, profile, onSave, onAccessCodeChange, onSignOut, isSaving, isChangingAccessCode }) {
    const [formData, setFormData] = useState({
        name: profile.player?.name || user.user_metadata?.name || '',
        email: profile.player?.email || user.email || '',
    });

    const [accessCodeData, setAccessCodeData] = useState({
        currentAccessCode: '',
        newAccessCode: '',
        confirmAccessCode: '',
    });

    // Handler für Formulareingaben
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleAccessCodeChange = (e) => {
        const { name, value } = e.target;
        setAccessCodeData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Handler für Formular-Submits
    const handleSaveProfile = async (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const handleChangeAccessCode = async (e) => {
        e.preventDefault();
        onAccessCodeChange(accessCodeData);
        setAccessCodeData({
            currentAccessCode: '',
            newAccessCode: '',
            confirmAccessCode: '',
        });
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Mein Profil</h1>

            {/* Profilinformationen */}
            <Card>
                <CardHeader>
                    <CardTitle>Persönliche Informationen</CardTitle>
                    <CardDescription>
                        Bearbeite deine persönlichen Informationen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSaveProfile}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="block text-sm font-medium">
                                    Name
                                </label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-medium">
                                    E-Mail
                                </label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    disabled
                                    className="bg-zinc-800"
                                />
                                <p className="text-xs text-zinc-500">
                                    Die E-Mail-Adresse kann nicht geändert werden.
                                </p>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="mt-4"
                            disabled={isSaving}
                        >
                            {isSaving ? 'Wird gespeichert...' : 'Speichern'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Zugangscode ändern */}
            <Card>
                <CardHeader>
                    <CardTitle>Zugangscode ändern</CardTitle>
                    <CardDescription>
                        Ändere deinen Zugangscode für die Anmeldung.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangeAccessCode}>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="currentAccessCode" className="block text-sm font-medium">
                                    Aktueller Zugangscode
                                </label>
                                <Input
                                    id="currentAccessCode"
                                    name="currentAccessCode"
                                    type="password"
                                    value={accessCodeData.currentAccessCode}
                                    onChange={handleAccessCodeChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="newAccessCode" className="block text-sm font-medium">
                                    Neuer Zugangscode
                                </label>
                                <Input
                                    id="newAccessCode"
                                    name="newAccessCode"
                                    type="password"
                                    value={accessCodeData.newAccessCode}
                                    onChange={handleAccessCodeChange}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="confirmAccessCode" className="block text-sm font-medium">
                                    Neuen Zugangscode bestätigen
                                </label>
                                <Input
                                    id="confirmAccessCode"
                                    name="confirmAccessCode"
                                    type="password"
                                    value={accessCodeData.confirmAccessCode}
                                    onChange={handleAccessCodeChange}
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="mt-4"
                            disabled={isChangingAccessCode}
                        >
                            {isChangingAccessCode ? 'Wird gespeichert...' : 'Zugangscode ändern'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Abmelden-Karte */}
            <Card className="border border-zinc-800">
                <CardHeader>
                    <CardTitle>Konto</CardTitle>
                    <CardDescription>
                        Abmelden und andere Kontoaktionen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <Button
                            onClick={onSignOut}
                            variant="primary"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                                className="w-5 h-5 mr-2"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                                />
                            </svg>
                            Abmelden
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Hauptkomponente
export default function ProfilePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingAccessCode, setIsChangingAccessCode] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;

    // Verbesserte Profil-Lade-Logik
    useEffect(() => {
        let isMounted = true;
        let retryTimeout;

        const fetchProfile = async () => {
            if (!user) return;

            try {
                setProfileLoading(true);
                const { data, error, stale } = await getProfile(user.id);

                if (!isMounted) return;

                if (error) {
                    if (retryCount < maxRetries) {
                        // Exponentielles Backoff für Wiederholungsversuche
                        const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                        retryTimeout = setTimeout(() => {
                            setRetryCount(prev => prev + 1);
                        }, delay);
                        return;
                    }
                    throw error;
                }

                setProfile(data);
                setRetryCount(0);

                if (stale) {
                    toast.warning('Einige Daten könnten veraltet sein', {
                        duration: 3000,
                        icon: '⚠️'
                    });
                }
            } catch (error) {
                if (!isMounted) return;

                const isPWA = window.matchMedia('(display-mode: standalone)').matches;
                if (isPWA) {
                    toast.error('Verbindungsproblem - Offline-Modus aktiv', {
                        duration: 4000,
                        icon: '📱'
                    });
                } else {
                    toast.error('Fehler beim Laden des Profils', {
                        duration: 3000
                    });
                }
                console.error("Profilfehler:", error);
            } finally {
                if (isMounted) {
                    setProfileLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            isMounted = false;
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [user, retryCount]);

    // Leite nicht angemeldete Benutzer zur Login-Seite weiter
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
            if (!document.referrer.includes('/login')) {
                toast.error('Bitte melde dich an, um dein Profil zu bearbeiten');
            }
        }
    }, [user, authLoading, router]);

    // Handler für Profilaktualisierung
    const handleSaveProfile = async (formData) => {
        if (!user) {
            toast.error('Sie müssen angemeldet sein, um Ihr Profil zu bearbeiten');
            return;
        }

        setIsSaving(true);

        try {
            const updates = {
                name: formData.name,
            };

            const { error } = await updateProfile(user.id, updates);
            if (error) throw error;

            // Optimistische UI-Aktualisierung
            setProfile(prev => ({
                ...prev,
                player: {
                    ...prev.player,
                    ...updates
                }
            }));

            toast.success('Profil erfolgreich aktualisiert');
        } catch (error) {
            const isPWA = window.matchMedia('(display-mode: standalone)').matches;
            if (isPWA) {
                toast.error('Änderungen konnten nicht gespeichert werden - bitte überprüfen Sie Ihre Internetverbindung', {
                    duration: 4000,
                    icon: '📱'
                });
            } else {
                toast.error('Fehler beim Aktualisieren des Profils');
            }
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    // Handler für Zugangscode-Änderung
    const handleChangeAccessCode = async (accessCodeData) => {
        if (!user) {
            toast.error('Du musst angemeldet sein, um deinen Zugangscode zu ändern');
            return;
        }

        const { currentAccessCode, newAccessCode, confirmAccessCode } = accessCodeData;

        if (!currentAccessCode || !newAccessCode || !confirmAccessCode) {
            toast.error('Bitte fülle alle Felder aus');
            return;
        }

        if (newAccessCode !== confirmAccessCode) {
            toast.error('Die neuen Zugangscodes stimmen nicht überein');
            return;
        }

        setIsChangingAccessCode(true);

        try {
            const { error } = await updateAccessCode(user.id, newAccessCode);
            if (error) throw error;
            toast.success('Zugangscode erfolgreich geändert');
        } catch (error) {
            toast.error('Fehler beim Ändern des Zugangscodes');
            console.error(error);
        } finally {
            setIsChangingAccessCode(false);
        }
    };

    // Handler für Abmeldung
    const handleSignOut = async () => {
        try {
            const { error } = await signOut();
            if (error) {
                toast.error('Fehler beim Abmelden');
            } else {
                toast.success('Erfolgreich abgemeldet');
                router.push('/');
            }
        } catch (error) {
            toast.error('Fehler beim Abmelden');
            console.error(error);
        }
    };

    if (authLoading) {
        return <LoadingIndicator message="Authentifizierung lädt..." />;
    }

    if (!user) {
        return null;
    }

    if (profileLoading || !profile) {
        return <LoadingIndicator message="Lade Profil..." />;
    }

    return (
        <Suspense fallback={<LoadingIndicator message="Lade Profil..." />}>
            <div className="space-y-6">
                <OfflineIndicator />
                <ProfileContent
                    user={user}
                    profile={profile}
                    onSave={handleSaveProfile}
                    onAccessCodeChange={handleChangeAccessCode}
                    onSignOut={handleSignOut}
                    isSaving={isSaving}
                    isChangingAccessCode={isChangingAccessCode}
                />
            </div>
        </Suspense>
    );
} 