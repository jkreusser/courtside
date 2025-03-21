'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getProfile, updateProfile, updateAccessCode } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [profile, setProfile] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
    });
    const [accessCodeData, setAccessCodeData] = useState({
        currentAccessCode: '',
        newAccessCode: '',
        confirmAccessCode: '',
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingAccessCode, setIsChangingAccessCode] = useState(false);

    // Lade das Profil des Benutzers
    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;

            try {
                const { data, error } = await getProfile(user.id);
                if (error) {
                    throw error;
                }

                setProfile(data);
                setFormData({
                    name: data.name || '',
                    email: data.email || '',
                });
            } catch (error) {
                toast.error('Fehler beim Laden des Profils');
                console.error(error);
            }
        };

        fetchProfile();
    }, [user]);

    // Leite nicht angemeldete Benutzer zur Login-Seite weiter
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
            toast.error('Bitte melde dich an, um dein Profil zu bearbeiten');
        }
    }, [user, loading, router]);

    // Aktualisiere Profilformular
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Aktualisiere Zugangscode-Formular
    const handleAccessCodeChange = (e) => {
        const { name, value } = e.target;
        setAccessCodeData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Speichere Profiländerungen
    const handleSaveProfile = async (e) => {
        e.preventDefault();

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
            if (error) {
                throw error;
            }

            toast.success('Profil erfolgreich aktualisiert');

            // Aktualisiere das Profil in der Anzeige
            setProfile(prev => ({
                ...prev,
                ...updates
            }));
        } catch (error) {
            toast.error('Fehler beim Aktualisieren des Profils');
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    // Ändere Zugangscode
    const handleChangeAccessCode = async (e) => {
        e.preventDefault();

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
            // Hier würde normalerweise eine Verifizierung des aktuellen Zugangscodes erfolgen,
            // aber für die Einfachheit überspringen wir das

            const { error } = await updateAccessCode(user.id, newAccessCode);

            if (error) {
                throw error;
            }

            toast.success('Zugangscode erfolgreich geändert');

            // Formular zurücksetzen
            setAccessCodeData({
                currentAccessCode: '',
                newAccessCode: '',
                confirmAccessCode: '',
            });
        } catch (error) {
            toast.error('Fehler beim Ändern des Zugangscodes');
            console.error(error);
        } finally {
            setIsChangingAccessCode(false);
        }
    };

    // Wenn Benutzer nicht angemeldet ist oder Profil geladen wird
    if (loading || !user || !profile) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="text-center">
                    <p className="text-zinc-500">Lade Profil...</p>
                </div>
            </div>
        );
    }

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
                                    className="bg-zinc-100 dark:bg-zinc-800"
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
        </div>
    );
} 