'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function NewSchedulePage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPlayers, setSelectedPlayers] = useState([]);
    const [courtCount, setCourtCount] = useState(1);
    const [scheduleName, setScheduleName] = useState('');
    const [creatingSchedule, setCreatingSchedule] = useState(false);
    const [previewSchedule, setPreviewSchedule] = useState(null);

    // Router-Schutz: Leite zur Login-Seite weiter, wenn der Benutzer nicht angemeldet ist
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lade alle verfügbaren Spieler
    useEffect(() => {
        const fetchPlayers = async () => {
            if (!user) return;

            try {
                setLoading(true);

                const { data, error } = await supabase
                    .from('players')
                    .select('*')
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

    // Funktion zum Umschalten des Spielerauswahlstatus
    const togglePlayerSelection = (playerId) => {
        setSelectedPlayers(prevSelected => {
            const newSelection = prevSelected.includes(playerId)
                ? prevSelected.filter(id => id !== playerId)
                : [...prevSelected, playerId];

            // Wenn mindestens 2 Spieler ausgewählt sind, aktualisiere die Vorschau automatisch
            if (newSelection.length >= 2) {
                updatePreview(newSelection);
            } else {
                setPreviewSchedule(null);
            }

            return newSelection;
        });
    };

    // Funktion zur Aktualisierung der Vorschau
    const updatePreview = (playerIds = selectedPlayers) => {
        if (playerIds.length < 2) return;

        try {
            // Ausgewählte Spieler aus der Spielerliste extrahieren
            const participatingPlayers = players.filter(player =>
                playerIds.includes(player.id)
            );

            // Spielplan-Algorithmus
            const rounds = createFairSchedule(participatingPlayers, courtCount);
            setPreviewSchedule(rounds);
        } catch (error) {
            console.error('Fehler beim Erstellen der Vorschau', error);
        }
    };

    // Aktualisiere die Vorschau, wenn sich die Court-Anzahl ändert
    useEffect(() => {
        if (selectedPlayers.length >= 2) {
            updatePreview();
        }
    }, [courtCount]);

    // Funktion zum Erstellen und Speichern des Spielplans
    const createSchedule = async () => {
        if (selectedPlayers.length < 2) {
            toast.error('Bitte wähle mindestens 2 Spieler aus');
            return;
        }

        if (!scheduleName.trim()) {
            toast.error('Bitte gib einen Namen für den Spielplan ein');
            return;
        }

        setCreatingSchedule(true);

        try {
            // Ausgewählte Spieler aus der Spielerliste extrahieren
            const participatingPlayers = players.filter(player =>
                selectedPlayers.includes(player.id)
            );

            // Spielplan-Algorithmus
            const rounds = createFairSchedule(participatingPlayers, courtCount);

            // Erstelle zuerst den Spielplan-Eintrag
            const { data: scheduleData, error: scheduleError } = await supabase
                .from('schedules')
                .insert({
                    name: scheduleName,
                    court_count: courtCount,
                    created_by: user.id
                })
                .select()
                .single();

            if (scheduleError) {
                throw scheduleError;
            }

            // Erstelle dann die Matches für den Spielplan
            const matchesToInsert = [];
            rounds.forEach(round => {
                round.matches.forEach(match => {
                    matchesToInsert.push({
                        schedule_id: scheduleData.id,
                        player1_id: match.player1.id,
                        player2_id: match.player2.id,
                        court: match.court,
                        round: round.round
                    });
                });
            });

            const { error: matchesError } = await supabase
                .from('schedule_matches')
                .insert(matchesToInsert);

            if (matchesError) {
                throw matchesError;
            }

            toast.success('Spielplan erfolgreich erstellt');
            router.push(`/games/schedules/${scheduleData.id}`);
        } catch (error) {
            toast.error('Fehler beim Erstellen des Spielplans');
            console.error(error);
        } finally {
            setCreatingSchedule(false);
        }
    };

    // Algorithmus zur Erstellung eines fairen Spielplans
    const createFairSchedule = (players, courts) => {
        // Wenn ungerade Anzahl von Spielern, füge einen Dummy-Spieler hinzu
        const allPlayers = [...players];
        if (allPlayers.length % 2 !== 0) {
            allPlayers.push({ id: 'dummy', name: 'Pausiert' });
        }

        const n = allPlayers.length;
        const rounds = [];

        // Wir verwenden den "Circle Method" Algorithmus für Rundenturniere
        // Ein Spieler bleibt an Position 0 fixiert, während alle anderen rotieren

        // (n-1) Runden, damit jeder gegen jeden spielt
        for (let round = 0; round < n - 1; round++) {
            const matchesThisRound = [];

            // Erstelle Paarungen für diese Runde
            for (let i = 0; i < n / 2; i++) {
                const player1 = allPlayers[i];
                const player2 = allPlayers[n - 1 - i];

                // Überspringe Paarungen mit dem Dummy-Spieler
                if (player1.id !== 'dummy' && player2.id !== 'dummy') {
                    matchesThisRound.push({
                        player1,
                        player2,
                        court: (i % courts) + 1 // Verteile die Spiele auf die verfügbaren Courts
                    });
                }
            }

            rounds.push({
                round: round + 1,
                matches: matchesThisRound
            });

            // Rotiere die Spieler (außer dem ersten) für die nächste Runde
            const firstPlayer = allPlayers[0];
            const lastPlayer = allPlayers[n - 1];

            for (let i = n - 1; i > 1; i--) {
                allPlayers[i] = allPlayers[i - 1];
            }

            allPlayers[1] = lastPlayer;
        }

        return rounds;
    };

    if (authLoading) {
        return <div className="text-center py-8">Lade...</div>;
    }

    if (!user) {
        return <div className="text-center py-8">Lade Benutzerdaten...</div>;
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold">Neuen Spielplan erstellen</h1>
                <Link href="/games" className="w-full md:w-auto">
                    <Button variant="secondary" className="w-full">Zurück zu Spielen</Button>
                </Link>
            </div>

            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Spielplan-Informationen</CardTitle>
                    <CardDescription>
                        Gib einen Namen für den Spielplan ein und wähle die Anzahl der verfügbaren Courts aus.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div>
                            <label htmlFor="scheduleName" className="block text-sm font-medium mb-2">Name des Spielplans</label>
                            <input
                                type="text"
                                id="scheduleName"
                                value={scheduleName}
                                onChange={(e) => setScheduleName(e.target.value)}
                                placeholder="z.B. Freitagabend Turnier"
                                className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Anzahl der Courts</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {[1, 2, 3, 4].map(count => (
                                    <div
                                        key={count}
                                        className={`p-4 border rounded-lg cursor-pointer text-center ${courtCount === count ? 'bg-primary/10 border-primary' : 'hover:border-primary'}`}
                                        onClick={() => {
                                            setCourtCount(count);
                                        }}
                                    >
                                        <div className="font-medium">{count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Spieler auswählen</CardTitle>
                    <CardDescription>
                        Wähle die Spieler aus, die am Spielplan teilnehmen sollen.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Lade Spieler...</div>
                    ) : players.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            Keine Spieler verfügbar. Bitte einen Administrator, Spieler hinzuzufügen.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {players.map((player) => (
                                <div
                                    key={player.id}
                                    className={`
                                        p-4 border rounded-lg cursor-pointer
                                        ${selectedPlayers.includes(player.id)
                                            ? 'bg-primary/10 border-primary'
                                            : 'hover:border-primary'}
                                    `}
                                    onClick={() => togglePlayerSelection(player.id)}
                                >
                                    <div className="font-medium">{player.name}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <div>
                        <span className="text-sm text-zinc-500">
                            {selectedPlayers.length} Spieler ausgewählt
                        </span>
                    </div>
                    <div className="flex space-x-2">
                        <Button
                            onClick={createSchedule}
                            disabled={selectedPlayers.length < 2 || !scheduleName.trim() || creatingSchedule}
                        >
                            Spielplan speichern
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            {previewSchedule && (
                <Card>
                    <CardHeader>
                        <CardTitle>Spielplan-Vorschau</CardTitle>
                        <CardDescription>
                            So wird dein Spielplan mit {selectedPlayers.length} Spielern auf {courtCount} {courtCount === 1 ? 'Court' : 'Courts'} aussehen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-8">
                            {previewSchedule.map((round, index) => (
                                <div key={index} className="space-y-2">
                                    <h3 className="text-lg font-semibold">Runde {round.round}</h3>

                                    {/* Mobile Ansicht */}
                                    <div className="md:hidden space-y-4">
                                        {round.matches.map((match, matchIndex) => (
                                            <div
                                                key={matchIndex}
                                                className="border border-zinc-800 rounded-lg p-4"
                                            >
                                                <div className="flex justify-between items-center mb-2">
                                                    <div className="text-sm text-zinc-400">
                                                        Court {match.court}
                                                    </div>
                                                </div>
                                                <div className="font-medium">
                                                    {match.player1.name} vs {match.player2.name}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Ansicht */}
                                    <div className="hidden md:block overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b border-zinc-800">
                                                    <th className="text-left py-2 px-4">Court</th>
                                                    <th className="text-left py-2 px-4">Spieler 1</th>
                                                    <th className="text-center py-2 px-4">vs</th>
                                                    <th className="text-left py-2 px-4">Spieler 2</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {round.matches.map((match, matchIndex) => (
                                                    <tr
                                                        key={matchIndex}
                                                        className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                                                    >
                                                        <td className="py-3 px-4">Court {match.court}</td>
                                                        <td className="py-3 px-4">{match.player1.name}</td>
                                                        <td className="py-3 px-4 text-center">vs</td>
                                                        <td className="py-3 px-4">{match.player2.name}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 