'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function NewGamePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayerId, setSelectedPlayerId] = useState('');
    const [setsToWin, setSetsToWin] = useState(3); // Standard: Best of 5 (3 Sätze zum Sieg)
    const [creatingGame, setCreatingGame] = useState(false);

    // Leite zur Login-Seite weiter, wenn der Benutzer nicht angemeldet ist
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lade alle verfügbaren Spieler (außer dem aktuellen Benutzer)
    useEffect(() => {
        const fetchPlayers = async () => {
            if (!user) return;

            try {
                setLoading(true);

                const { data, error } = await supabase
                    .from('players')
                    .select('*')
                    .neq('id', user.id)
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

        if (user && !authLoading) {
            fetchPlayers();
        }
    }, [user, authLoading]);

    // Erstelle ein neues Spiel
    const handleCreateGame = async () => {
        if (!selectedPlayerId) {
            toast.error('Bitte wähle einen Gegner aus');
            return;
        }

        try {
            setCreatingGame(true);

            // Erstelle einen neuen Spieleintrag
            const { data, error } = await supabase
                .from('games')
                .insert({
                    player1_id: user.id,
                    player2_id: selectedPlayerId,
                    status: 'active',
                    sets_to_win: setsToWin
                })
                .select()
                .single();

            if (error) {
                throw error;
            }

            if (!data) {
                throw new Error('Keine Daten vom Server erhalten');
            }

            // Überprüfe, ob der Spieler bereits das "first_match" Achievement hat
            await checkFirstMatchAchievement();

            toast.success('Spiel erfolgreich erstellt');

            // Leite zur Spielseite weiter
            router.push(`/games/${data.id}`);
        } catch (error) {
            const errorMessage = error?.message || 'Unbekannter Fehler';
            toast.error(`Fehler beim Erstellen des Spiels: ${errorMessage}`);

            // Verbesserte Fehlerprotokollierung, die auch mit leeren Objekten umgehen kann
            if (error && Object.keys(error).length === 0) {
                console.error('Fehler beim Erstellen des Spiels: Leeres Fehlerobjekt empfangen');
            } else if (error === null || error === undefined) {
                console.error('Fehler beim Erstellen des Spiels: Kein Fehlerobjekt vorhanden');
            } else {
                console.error('Fehler beim Erstellen des Spiels:',
                    JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        } finally {
            setCreatingGame(false);
        }
    };

    // Funktion zum Überprüfen und Freischalten des first_match Achievements
    const checkFirstMatchAchievement = async () => {
        try {
            // Überprüfen, ob der Benutzer bereits das "first_match" Achievement hat
            const { data: achievementData, error: achievementError } = await supabase
                .from('player_achievements')
                .select('achievement_id')
                .eq('player_id', user.id)
                .eq('achievement_id', 'first_match');

            if (achievementError) {
                console.error('Fehler beim Prüfen des first_match Achievements:', achievementError);
                return;
            }

            // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
            if (!achievementData || achievementData.length === 0) {
                const { error: unlockError } = await supabase
                    .from('player_achievements')
                    .insert({
                        player_id: user.id,
                        achievement_id: 'first_match',
                        achieved_at: new Date().toISOString()
                    });

                if (unlockError) {
                    console.error('Fehler beim Freischalten des first_match Achievements:', unlockError);
                } else {
                    toast.success('Achievement freigeschaltet: Erstes Spiel!', { duration: 5000 });
                }
            }
        } catch (error) {
            console.error('Fehler bei der Achievement-Überprüfung:', error);
        }
    };

    // Berechne die Gesamtanzahl der Sätze basierend auf der Anzahl der zum Sieg benötigten Sätze
    const getTotalSets = (sets) => {
        return sets * 2 - 1;
    };

    if (authLoading) {
        return <div className="text-center py-8">Lade...</div>;
    }

    // Wir brauchen diese Überprüfung nicht mehr, da wir bereits durch useEffect zur Login-Seite weiterleiten
    // Aber wir behalten es für den Fall, dass die Weiterleitung aus irgendeinem Grund nicht funktioniert
    if (!user) {
        return <div className="text-center py-8">Lade Benutzerdaten...</div>;
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Neues Spiel erstellen</h1>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Spieleinstellungen</CardTitle>
                    <CardDescription>
                        Wähle die Anzahl der Sätze für das Spiel.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Format auswählen</label>
                            <div className="grid grid-cols-3 gap-4">
                                <div
                                    className={`p-4 border rounded-lg cursor-pointer text-center ${setsToWin === 1 ? 'bg-primary/10 border-primary' : 'hover:border-primary'}`}
                                    onClick={() => setSetsToWin(1)}
                                >
                                    <div className="font-medium">Best of 1</div>
                                </div>
                                <div
                                    className={`p-4 border rounded-lg cursor-pointer text-center ${setsToWin === 2 ? 'bg-primary/10 border-primary' : 'hover:border-primary'}`}
                                    onClick={() => setSetsToWin(2)}
                                >
                                    <div className="font-medium">Best of 3</div>
                                </div>
                                <div
                                    className={`p-4 border rounded-lg cursor-pointer text-center ${setsToWin === 3 ? 'bg-primary/10 border-primary' : 'hover:border-primary'}`}
                                    onClick={() => setSetsToWin(3)}
                                >
                                    <div className="font-medium">Best of 5</div>
                                </div>
                            </div>
                        </div>
                        <div className="p-3 bg-zinc-50 rounded-md text-center">
                            <p className="text-sm text-zinc-600">
                                Ein Spieler muss <span className="font-medium">{setsToWin}</span> {setsToWin === 1 ? 'Satz' : 'Sätze'} gewinnen (Best of {getTotalSets(setsToWin)})
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Wähle deinen Gegner</CardTitle>
                    <CardDescription>
                        Wähle einen Spieler aus, gegen den du spielen möchtest.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Lade Spieler...</div>
                    ) : players.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            Keine anderen Spieler verfügbar. Bitte einen Administrator, weitere Spieler hinzuzufügen.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {players.map((player) => (
                                <div
                                    key={player.id}
                                    className={`
p-4 border rounded-lg cursor-pointer
${selectedPlayerId === player.id
                                            ? 'bg-primary/10 border-primary'
                                            : 'hover:border-primary'}
`}
                                    onClick={() => setSelectedPlayerId(player.id)}
                                >
                                    <div className="font-medium">{player.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Link href="/games">
                        <Button variant="secondary">Abbrechen</Button>
                    </Link>
                    <Button
                        onClick={handleCreateGame}
                        disabled={!selectedPlayerId || creatingGame}
                    >
                        {creatingGame ? 'Erstelle Spiel...' : 'Spiel erstellen'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
} 