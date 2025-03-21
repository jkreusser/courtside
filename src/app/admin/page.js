'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { createUserWithAccessCode } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newPlayer, setNewPlayer] = useState({ name: '', email: '' });
    const [newPlayerLoading, setNewPlayerLoading] = useState(false);
    const [globalAccessCode, setGlobalAccessCode] = useState('');

    // Lade den globalen Zugangscode aus den Umgebungsvariablen
    useEffect(() => {
        const code = process.env.NEXT_PUBLIC_GLOBAL_ACCESS_CODE;
        setGlobalAccessCode(code || 'Nicht konfiguriert');
    }, []);

    // Leite nicht-Admin-Benutzer zurück zur Startseite
    useEffect(() => {
        if (!isAdmin && !loading) {
            router.push('/');
            toast.error('Nur Administratoren haben Zugriff auf diese Seite');
        }
    }, [isAdmin, loading, router]);

    // Lade alle Spieler
    useEffect(() => {
        const fetchPlayers = async () => {
            try {
                setLoading(true);

                const { data, error } = await supabase
                    .from('players')
                    .select('*, profiles(role)')
                    .order('name');

                if (error) {
                    throw error;
                }

                setPlayers(data || []);
            } catch (error) {
                toast.error('Fehler beim Laden der Spieler');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlayers();
    }, []);

    // Speichere einen neuen Spieler
    const handleAddPlayer = async (e) => {
        e.preventDefault();

        if (!newPlayer.name || !newPlayer.email) {
            toast.error('Bitte fülle alle Felder aus');
            return;
        }

        try {
            setNewPlayerLoading(true);

            // Benutzer mit globalem Zugangscode erstellen
            const { data, error } = await createUserWithAccessCode(
                newPlayer.email,
                newPlayer.name,
                process.env.NEXT_PUBLIC_GLOBAL_ACCESS_CODE,
                'player'
            );

            if (error) {
                throw error;
            }

            toast.success(`Spieler ${newPlayer.name} wurde hinzugefügt`);

            // Setze das Formular zurück
            setNewPlayer({ name: '', email: '' });

            // Lade die Spielerliste neu
            const { data: refreshedPlayers } = await supabase
                .from('players')
                .select('*, profiles(role)')
                .order('name');

            setPlayers(refreshedPlayers || []);
        } catch (error) {
            toast.error(`Fehler beim Hinzufügen des Spielers: ${error.message}`);
            console.error(error);
        } finally {
            setNewPlayerLoading(false);
        }
    };

    // Entferne einen Spieler
    const handleRemovePlayer = async (id, name) => {
        if (!confirm(`Möchtest du den Spieler ${name} wirklich entfernen?`)) {
            return;
        }

        try {
            // Entferne den Spieler aus der players-Tabelle
            const { error: playerError } = await supabase
                .from('players')
                .delete()
                .eq('id', id);

            if (playerError) {
                throw playerError;
            }

            // Entferne den Benutzer aus der Auth-Tabelle
            const { error: authError } = await supabase.auth.admin.deleteUser(id);

            if (authError) {
                throw authError;
            }

            toast.success(`Spieler ${name} wurde entfernt`);

            // Aktualisiere die Spielerliste
            setPlayers(players.filter(player => player.id !== id));
        } catch (error) {
            toast.error(`Fehler beim Entfernen des Spielers: ${error.message}`);
            console.error(error);
        }
    };

    // Ändere die Rolle eines Spielers
    const toggleAdminStatus = async (id, name, isCurrentAdmin) => {
        const newRole = isCurrentAdmin ? 'player' : 'admin';

        try {
            // Aktualisiere die Rolle in der Profile-Tabelle
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', id);

            if (profileError) {
                throw profileError;
            }

            toast.success(`${name} ist jetzt ${newRole === 'admin' ? 'ein Administrator' : 'ein Spieler'}`);

            // Aktualisiere die Spielerliste
            const { data, error } = await supabase
                .from('players')
                .select('*, profiles(role)')
                .order('name');

            if (error) {
                throw error;
            }

            setPlayers(data || []);
        } catch (error) {
            toast.error(`Fehler beim Ändern der Rolle: ${error.message}`);
            console.error(error);
        }
    };

    if (!isAdmin) {
        return null; // Nichts anzeigen, wenn kein Admin (wird durch useEffect zur Startseite weitergeleitet)
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Admin-Dashboard</h1>

            {/* Zugangscode-Information */}
            <Card>
                <CardHeader>
                    <CardTitle>Globaler Zugangscode</CardTitle>
                    <CardDescription>
                        Dieser Code kann von allen Spielern zur Anmeldung verwendet werden.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                        <span className="font-mono font-bold">{globalAccessCode}</span>
                    </div>
                    <p className="mt-4 text-sm text-zinc-500">
                        Der globale Zugangscode ist in der Umgebungsvariable NEXT_PUBLIC_GLOBAL_ACCESS_CODE festgelegt.
                        Um ihn zu ändern, aktualisiere diese Variable in der .env.local-Datei und starte die App neu.
                    </p>
                </CardContent>
            </Card>

            {/* Spieler hinzufügen */}
            <Card>
                <CardHeader>
                    <CardTitle>Neuen Spieler hinzufügen</CardTitle>
                    <CardDescription>
                        Füge einen neuen Spieler zur Anwendung hinzu. Der Spieler kann sich mit seiner E-Mail und dem globalen Zugangscode anmelden.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddPlayer}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label htmlFor="name" className="block text-sm font-medium">
                                    Name
                                </label>
                                <Input
                                    id="name"
                                    value={newPlayer.name}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="email" className="block text-sm font-medium">
                                    E-Mail
                                </label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={newPlayer.email}
                                    onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                        <Button
                            type="submit"
                            className="mt-4"
                            disabled={newPlayerLoading}
                        >
                            {newPlayerLoading ? 'Wird hinzugefügt...' : 'Spieler hinzufügen'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Spielerliste */}
            <Card>
                <CardHeader>
                    <CardTitle>Spielerverwaltung</CardTitle>
                    <CardDescription>
                        Verwalte bestehende Spieler und deren Zugriffsrechte.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Lade Spieler...</div>
                    ) : players.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            Keine Spieler vorhanden. Füge oben neue Spieler hinzu.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4">Name</th>
                                        <th className="text-left py-3 px-4">E-Mail</th>
                                        <th className="text-left py-3 px-4">Rolle</th>
                                        <th className="text-left py-3 px-4">Aktionen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {players.map((player) => (
                                        <tr
                                            key={player.id}
                                            className="border-b hover:bg-zinc-50 dark:hover:bg-zinc-900"
                                        >
                                            <td className="py-3 px-4">{player.name}</td>
                                            <td className="py-3 px-4">{player.email}</td>
                                            <td className="py-3 px-4">
                                                {player.profiles?.role === 'admin' ? (
                                                    <span className="text-xs font-medium px-2 py-1 bg-purple-100 text-purple-800 rounded-full">
                                                        Administrator
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                                                        Spieler
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => toggleAdminStatus(
                                                            player.id,
                                                            player.name,
                                                            player.profiles?.role === 'admin'
                                                        )}
                                                    >
                                                        {player.profiles?.role === 'admin' ? 'Zu Spieler machen' : 'Zu Admin machen'}
                                                    </Button>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => handleRemovePlayer(player.id, player.name)}
                                                    >
                                                        Entfernen
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 