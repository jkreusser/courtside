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

    // Lade das Profil des Benutzers
    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            if (!user) return;

            try {
                setProfileLoading(true);
                const { data, error, stale } = await getProfile(user.id);

                if (error) throw error;

                if (isMounted) {
                    setProfile(data);
                    if (stale) {
                        // Wenn die Daten veraltet sind, zeige einen Hinweis
                        toast.error('Verbindungsprobleme - einige Daten könnten veraltet sein');
                    }
                }
            } catch (error) {
                if (isMounted) {
                    toast.error('Fehler beim Laden des Profils');
                    console.error("Profilfehler:", error);
                }
            } finally {
                if (isMounted) {
                    setProfileLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            isMounted = false;
        };
    }, [user]);

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
            toast.error('Du musst angemeldet sein, um dein Profil zu bearbeiten');
            return;
        }

        setIsSaving(true);

        try {
            const updates = {
                name: formData.name,
            };

            const { error } = await updateProfile(user.id, updates);
            if (error) throw error;

            toast.success('Profil erfolgreich aktualisiert');
            setProfile(prev => ({
                ...prev,
                player: {
                    ...prev.player,
                    ...updates
                }
            }));
        } catch (error) {
            toast.error('Fehler beim Aktualisieren des Profils');
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
            <ProfileContent
                user={user}
                profile={profile}
                onSave={handleSaveProfile}
                onAccessCodeChange={handleChangeAccessCode}
                onSignOut={handleSignOut}
                isSaving={isSaving}
                isChangingAccessCode={isChangingAccessCode}
            />
        </Suspense>
    );
} 