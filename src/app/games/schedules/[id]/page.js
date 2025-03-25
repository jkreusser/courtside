'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter, useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function ScheduleDetailPage() {
    const params = useParams();
    const id = params.id;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [schedule, setSchedule] = useState(null);
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOwner, setIsOwner] = useState(false);
    const [playerNames, setPlayerNames] = useState({});
    const [isDeleting, setIsDeleting] = useState(false);

    // Router-Schutz: Leite zur Login-Seite weiter, wenn der Benutzer nicht angemeldet ist
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lade den Spielplan und die Matches
    useEffect(() => {
        let isMounted = true;
        let retryTimeout;

        const fetchScheduleData = async () => {
            if (!user) return;

            try {
                setLoading(true);

                // Optimierte Spielplan-Abfrage mit spezifischer Feldauswahl
                const { data: scheduleData, error: scheduleError } = await supabase
                    .from('schedules')
                    .select(`
                        id,
                        name,
                        created_at,
                        court_count,
                        created_by
                    `)
                    .eq('id', id)
                    .single()
                    .throwOnError();

                if (scheduleError) {
                    throw scheduleError;
                }

                if (!scheduleData) {
                    toast.error('Spielplan nicht gefunden');
                    router.push('/games/schedules');
                    return;
                }

                if (isMounted) {
                    setSchedule(scheduleData);
                }

                // Optimierte Matches-Abfrage mit spezifischer Feldauswahl
                const { data: matchesData, error: matchesError } = await supabase
                    .from('schedule_matches')
                    .select(`
                        id,
                        round,
                        player1_id,
                        player2_id,
                        schedule_id
                    `)
                    .eq('schedule_id', id)
                    .order('round', { ascending: true })
                    .throwOnError();

                if (matchesError) {
                    throw matchesError;
                }

                if (isMounted) {
                    // Sammle einzigartige Spieler-IDs
                    const playerIds = new Set();
                    matchesData.forEach(match => {
                        if (match.player1_id) playerIds.add(match.player1_id);
                        if (match.player2_id) playerIds.add(match.player2_id);
                    });
                    // Füge den Ersteller des Spielplans hinzu
                    if (scheduleData.created_by) playerIds.add(scheduleData.created_by);

                    // Lade Spielernamen in einem Batch
                    if (playerIds.size > 0) {
                        const { data: playersData, error: playersError } = await supabase
                            .from('players')
                            .select('id, name')
                            .in('id', Array.from(playerIds))
                            .throwOnError();

                        if (!playersError && playersData) {
                            const namesMap = {};
                            playersData.forEach(player => {
                                namesMap[player.id] = player.name;
                            });
                            if (isMounted) {
                                setPlayerNames(namesMap);
                            }
                        }
                    }

                    // Gruppiere Matches nach Runden
                    const matchesByRound = {};
                    matchesData.forEach(match => {
                        if (!matchesByRound[match.round]) {
                            matchesByRound[match.round] = [];
                        }
                        matchesByRound[match.round].push(match);
                    });

                    if (isMounted) {
                        setMatches(matchesByRound);
                    }
                }
            } catch (error) {
                console.error('Fehler beim Laden des Spielplans:', error);
                toast.error('Fehler beim Laden des Spielplans');

                // Wiederholungsversuch mit exponentieller Verzögerung
                let retryCount = 0;
                const maxRetries = 5;
                const retryWithBackoff = async () => {
                    if (retryCount >= maxRetries || !isMounted) return;

                    retryCount++;
                    const delay = 1000 * Math.pow(2, retryCount - 1) * (0.5 + Math.random() * 0.5);
                    console.log(`Wiederhole in ${delay}ms (${retryCount}/${maxRetries})...`);

                    await new Promise(resolve => setTimeout(resolve, delay));

                    try {
                        // Wiederhole die Spielplan-Abfrage
                        const { data: retryScheduleData, error: retryScheduleError } = await supabase
                            .from('schedules')
                            .select(`
                                id,
                                name,
                                created_at,
                                court_count,
                                created_by
                            `)
                            .eq('id', id)
                            .single()
                            .throwOnError();

                        if (retryScheduleError) {
                            throw retryScheduleError;
                        }

                        // Wiederhole die Matches-Abfrage
                        const { data: retryMatchesData, error: retryMatchesError } = await supabase
                            .from('schedule_matches')
                            .select(`
                                id,
                                round,
                                player1_id,
                                player2_id,
                                schedule_id
                            `)
                            .eq('schedule_id', id)
                            .order('round', { ascending: true })
                            .throwOnError();

                        if (retryMatchesError) {
                            throw retryMatchesError;
                        }

                        if (isMounted) {
                            setSchedule(retryScheduleData);

                            // Sammle einzigartige Spieler-IDs
                            const playerIds = new Set();
                            retryMatchesData.forEach(match => {
                                if (match.player1_id) playerIds.add(match.player1_id);
                                if (match.player2_id) playerIds.add(match.player2_id);
                            });
                            // Füge den Ersteller des Spielplans hinzu
                            if (retryScheduleData.created_by) playerIds.add(retryScheduleData.created_by);

                            // Lade Spielernamen in einem Batch
                            if (playerIds.size > 0) {
                                const { data: retryPlayersData, error: retryPlayersError } = await supabase
                                    .from('players')
                                    .select('id, name')
                                    .in('id', Array.from(playerIds))
                                    .throwOnError();

                                if (!retryPlayersError && retryPlayersData) {
                                    const namesMap = {};
                                    retryPlayersData.forEach(player => {
                                        namesMap[player.id] = player.name;
                                    });
                                    setPlayerNames(namesMap);
                                }
                            }

                            // Gruppiere Matches nach Runden
                            const matchesByRound = {};
                            retryMatchesData.forEach(match => {
                                if (!matchesByRound[match.round]) {
                                    matchesByRound[match.round] = [];
                                }
                                matchesByRound[match.round].push(match);
                            });

                            setMatches(matchesByRound);
                            return true;
                        }
                    } catch (retryError) {
                        console.error('Fehler beim Wiederholungsversuch:', retryError);
                    }

                    if (retryCount < maxRetries && isMounted) {
                        return retryWithBackoff();
                    }

                    return false;
                };

                const success = await retryWithBackoff();
                if (!success && isMounted) {
                    // Setze einen Timeout für den nächsten Versuch
                    retryTimeout = setTimeout(() => {
                        router.refresh();
                    }, 5000);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (user && !authLoading) {
            fetchScheduleData();
        }

        return () => {
            isMounted = false;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [id, user, authLoading, router]);

    // Hilfsfunktion zum Anzeigen des Spielernamens
    const getPlayerName = (playerId) => {
        if (!playerId) return 'Kein Spieler';
        return playerNames[playerId] || `Spieler ${playerId.substring(0, 8)}...`;
    };

    // Lösche den Spielplan
    const deleteSchedule = async () => {
        if (!confirm('Möchtest du diesen Spielplan wirklich löschen?')) {
            return;
        }

        try {
            setIsDeleting(true);

            // Lösche zuerst die Matches
            const { error: matchesError } = await supabase
                .from('schedule_matches')
                .delete()
                .eq('schedule_id', id);

            if (matchesError) {
                throw matchesError;
            }

            // Lösche dann den Spielplan
            const { error } = await supabase
                .from('schedules')
                .delete()
                .eq('id', id);

            if (error) {
                throw error;
            }

            toast.success('Spielplan erfolgreich gelöscht');

            // Direkte Navigation statt Timeout
            router.replace('/games');
        } catch (error) {
            toast.error('Fehler beim Löschen des Spielplans');
            console.error('Fehler beim Löschen des Spielplans:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (authLoading || loading) {
        return <div className="text-center py-8">Lade Spielplan...</div>;
    }

    if (!user) {
        return null;
    }

    if (!schedule) {
        return <div className="text-center py-8">Spielplan nicht gefunden.</div>;
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            {/* Mobile Layout */}
            <div className="flex flex-row items-center justify-between md:hidden mb-4">
                <h1 className="text-2xl font-bold truncate pr-2">{schedule.name}</h1>
                <button
                    onClick={deleteSchedule}
                    className="p-2 rounded-md text-white hover:text-white hover:bg-zinc-800 flex items-center justify-center"
                    title="Spielplan löschen"
                    aria-label="Spielplan löschen"
                    disabled={isDeleting}
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-6 h-6"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                        />
                    </svg>
                </button>
            </div>

            {/* Mobile Back Button */}
            <div className="md:hidden mb-4">
                <Link href="/games" className="w-full">
                    <Button variant="secondary" className="w-full">Zurück zu Spielen</Button>
                </Link>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-3xl font-bold truncate">{schedule.name}</h1>
                <div className="flex items-center gap-2">
                    <Link href="/games">
                        <Button variant="secondary">Zurück zu Spielen</Button>
                    </Link>
                    <Button
                        variant="destructive"
                        onClick={deleteSchedule}
                        className="w-11 h-11 !p-2 flex items-center justify-center hover:bg-white/10"
                        title="Spielplan löschen"
                        aria-label="Spielplan löschen"
                        disabled={isDeleting}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-6 h-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                            />
                        </svg>
                    </Button>
                </div>
            </div>

            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>Spielplan-Details</CardTitle>
                    <CardDescription>
                        Informationen über diesen Spielplan.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <div className="text-sm text-zinc-500 mb-1">Anzahl Courts</div>
                            <div className="font-semibold">
                                {schedule.court_count} {schedule.court_count === 1 ? 'Court' : 'Courts'}
                            </div>
                        </div>
                        <div>
                            <div className="text-sm text-zinc-500 mb-1">Erstellt von</div>
                            <div className="font-semibold">{getPlayerName(schedule.created_by)}</div>
                        </div>
                        <div>
                            <div className="text-sm text-zinc-500 mb-1">Erstellt am</div>
                            <div className="font-semibold">{new Date(schedule.created_at).toLocaleDateString()}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {Object.keys(matches).length > 0 ? (
                Object.keys(matches).map(round => (
                    <Card key={round} className="mb-6">
                        <CardHeader>
                            <CardTitle>Runde {round}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Mobile Ansicht */}
                            <div className="md:hidden space-y-4">
                                {matches[round].map((match, index) => (
                                    <div
                                        key={match.id}
                                        className="border border-zinc-800 rounded-lg p-4"
                                    >
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="text-sm text-zinc-400">
                                                Court {(index % schedule.court_count) + 1}
                                            </div>
                                        </div>
                                        <div className="font-medium">
                                            {getPlayerName(match.player1_id)} vs {getPlayerName(match.player2_id)}
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
                                        {matches[round].map((match, index) => (
                                            <tr
                                                key={match.id}
                                                className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                                            >
                                                <td className="py-3 px-4">{(index % schedule.court_count) + 1}</td>
                                                <td className="py-3 px-4">{getPlayerName(match.player1_id)}</td>
                                                <td className="py-3 px-4 text-center">vs</td>
                                                <td className="py-3 px-4">{getPlayerName(match.player2_id)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                ))
            ) : (
                <Card>
                    <CardContent className="text-center py-8 text-zinc-500">
                        Keine Spiele für diesen Spielplan gefunden.
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 