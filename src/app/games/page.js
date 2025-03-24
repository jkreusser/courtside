'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function GamesPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed', 'my_games'
    const [displayCount, setDisplayCount] = useState(5); // Anzahl der anzuzeigenden Spiele
    const [scheduleDisplayCount, setScheduleDisplayCount] = useState(5); // Anzahl der anzuzeigenden Spielpläne

    // Spielplan-States
    const [schedules, setSchedules] = useState([]);
    const [loadingSchedules, setLoadingSchedules] = useState(true);
    const [playerCounts, setPlayerCounts] = useState({});

    // Router-Schutz: Leite zur Login-Seite weiter, wenn der Benutzer nicht angemeldet ist
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lade alle Spiele
    useEffect(() => {
        const fetchGames = async () => {
            if (!user) return;

            try {
                setLoading(true);

                // Verbesserte Spiele-Abfrage mit Limitierung, Paginierung und spezifischer Attributselektion
                const PAGE_SIZE = 20; // Anzahl der Spiele pro Seite
                const { data, error } = await supabase
                    .from('games')
                    .select(`
                        id, 
                        status, 
                        created_at,
                        player1_id, 
                        player2_id, 
                        winner_id,
                        player1:player1_id(id, name),
                        player2:player2_id(id, name),
                        scores(id, player1_score, player2_score)
                    `)
                    .order('created_at', { ascending: false })
                    .range(0, PAGE_SIZE - 1); // Erste Seite laden

                if (error) {
                    console.error('Fehler beim Laden der Spiele:', error);
                    toast.error('Fehler beim Laden der Spiele');

                    // Wiederholungsversuch mit exponentieller Verzögerung
                    let retryCount = 0;
                    const maxRetries = 3;
                    const retryWithBackoff = async () => {
                        if (retryCount >= maxRetries) return;

                        retryCount++;
                        const delay = 1000 * Math.pow(2, retryCount - 1); // Exponentielles Backoff
                        console.log(`Wiederhole in ${delay}ms (${retryCount}/${maxRetries})...`);

                        await new Promise(resolve => setTimeout(resolve, delay));

                        const { data: retryData, error: retryError } = await supabase
                            .from('games')
                            .select(`
                                id, 
                                status, 
                                created_at,
                                player1_id, 
                                player2_id, 
                                winner_id,
                                player1:player1_id(id, name),
                                player2:player2_id(id, name),
                                scores(id, player1_score, player2_score)
                            `)
                            .order('created_at', { ascending: false })
                            .range(0, PAGE_SIZE - 1);

                        if (!retryError) {
                            setGames(retryData || []);
                            setLoading(false);
                            return true;
                        }

                        if (retryCount < maxRetries) {
                            return retryWithBackoff();
                        }

                        return false;
                    };

                    const success = await retryWithBackoff();
                    if (!success) {
                        router.refresh();
                    }
                    return;
                }

                setGames(data || []);
            } catch (error) {
                console.error('Unerwarteter Fehler beim Laden der Spiele:', error);
                toast.error('Fehler beim Laden der Spiele');

                // Warte kurz und versuche es nochmal
                setTimeout(() => {
                    router.refresh();
                }, 3000);
            } finally {
                setLoading(false);
            }
        };

        const fetchSchedules = async () => {
            if (!user) return;

            try {
                setLoadingSchedules(true);

                // Lade Spielpläne
                const { data: schedulesData, error: schedulesError } = await supabase
                    .from('schedules')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (schedulesError) {
                    console.error('Fehler beim Laden der Spielpläne:', schedulesError);
                    toast.error('Fehler beim Laden der Spielpläne');
                    return;
                }

                setSchedules(schedulesData || []);

                // Lade die Anzahl der Spieler pro Spielplan
                const counts = {};

                if (schedulesData && schedulesData.length > 0) {
                    for (const schedule of schedulesData) {
                        const { data: matchesData, error: matchesError } = await supabase
                            .from('schedule_matches')
                            .select('player1_id, player2_id')
                            .eq('schedule_id', schedule.id);

                        if (!matchesError && matchesData) {
                            // Sammle einzigartige Spieler-IDs
                            const playerIds = new Set();
                            matchesData.forEach(match => {
                                if (match.player1_id) playerIds.add(match.player1_id);
                                if (match.player2_id) playerIds.add(match.player2_id);
                            });

                            counts[schedule.id] = playerIds.size;
                        }
                    }
                }

                setPlayerCounts(counts);
            } catch (error) {
                console.error('Unerwarteter Fehler beim Laden der Spielpläne:', error);
                toast.error('Fehler beim Laden der Spielpläne');
            } finally {
                setLoadingSchedules(false);
            }
        };

        if (user && !authLoading) {
            fetchGames();
            fetchSchedules();
        }
    }, [user, authLoading, router]);

    // Gefilterte Spiele basierend auf dem ausgewählten Filter
    const filteredGames = games.filter(game => {
        if (filter === 'active') return game.status === 'in_progress';
        if (filter === 'completed') return game.status === 'completed';
        if (filter === 'my_games') return game.player1_id === user.id || game.player2_id === user.id;
        return true; // 'all'
    });

    // Begrenzte Anzahl von Spielen für die Anzeige
    const displayedGames = filteredGames.slice(0, displayCount);

    // Begrenzte Anzahl von Spielplänen für die Anzeige
    const displayedSchedules = schedules.slice(0, scheduleDisplayCount);

    // Funktion zum Laden weiterer Spiele
    const loadMoreGames = () => {
        setDisplayCount(prevCount => prevCount + 5);
    };

    // Funktion zum Laden weiterer Spielpläne
    const loadMoreSchedules = () => {
        setScheduleDisplayCount(prevCount => prevCount + 5);
    };

    // Hilfsfunktion zum Anzeigen des Spielstatus
    const renderStatus = (status) => {
        if (status === 'completed') {
            return <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary text-primary">Abgeschlossen</span>;
        } else if (status === 'in_progress') {
            return <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-800 text-amber-200">Läuft</span>;
        } else {
            return <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-800 text-blue-200">Geplant</span>;
        }
    };

    if (authLoading) {
        return <div className="text-center py-8">Authentifizierung lädt...</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold">Alle Spiele</h1>
                <div className="flex flex-col sm:flex-row gap-2">
                    <Link href="/games/new" className="w-full sm:w-auto">
                        <Button className="w-full">Neues Spiel starten</Button>
                    </Link>
                </div>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                <Button
                    variant="outline"
                    size="sm"
                    className={`${filter === 'all' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'} border-0 whitespace-nowrap`}
                    onClick={() => setFilter('all')}
                >
                    Alle
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className={`${filter === 'my_games' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'} border-0 whitespace-nowrap`}
                    onClick={() => setFilter('my_games')}
                >
                    Meine Spiele
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className={`${filter === 'active' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'} border-0 whitespace-nowrap`}
                    onClick={() => setFilter('active')}
                >
                    Aktive
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    className={`${filter === 'completed' ? 'bg-zinc-800 text-white' : 'bg-zinc-900 text-zinc-400'} border-0 whitespace-nowrap`}
                    onClick={() => setFilter('completed')}
                >
                    Abgeschlossene
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Spielübersicht</CardTitle>
                    <CardDescription>
                        Hier siehst du alle Spiele in CourtSide.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">Lade Spiele...</div>
                    ) : filteredGames.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            Keine Spiele gefunden.
                        </div>
                    ) : (
                        <>
                            {/* Mobile Ansicht (Karten) */}
                            <div className="md:hidden space-y-4">
                                {displayedGames.map((game) => {
                                    // Berechne den aktuellen Spielstand
                                    const player1Sets = game.scores?.filter(score =>
                                        score.player1_score > score.player2_score
                                    ).length || 0;

                                    const player2Sets = game.scores?.filter(score =>
                                        score.player2_score > score.player1_score
                                    ).length || 0;

                                    return (
                                        <div
                                            key={game.id}
                                            className="border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                                            onClick={() => router.push(`/games/${game.id}`)}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="text-sm text-zinc-400">
                                                    {new Date(game.created_at).toLocaleDateString()}
                                                </div>
                                                <div>
                                                    {renderStatus(game.status)}
                                                </div>
                                            </div>

                                            <div className="mb-3">
                                                <div className="font-semibold mb-1">
                                                    <span className={game.winner_id === game.player1_id ? 'font-bold text-primary' : ''}>
                                                        {game.player1?.name || 'Unbekannt'}
                                                    </span>
                                                    {' vs '}
                                                    <span className={game.winner_id === game.player2_id ? 'font-bold text-primary' : ''}>
                                                        {game.player2?.name || 'Unbekannt'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center">
                                                <div>
                                                    <span className="text-xs font-medium bg-zinc-800 px-2 py-1 rounded">
                                                        {game.sets_to_win ? `Best of ${game.sets_to_win * 2 - 1}` : 'Best of 5'}
                                                    </span>
                                                </div>
                                                <div className="font-medium text-lg">
                                                    {game.scores && game.scores.length > 0 ? (
                                                        <span>{player1Sets} : {player2Sets}</span>
                                                    ) : (
                                                        <span className="text-zinc-500 text-sm">Keine Ergebnisse</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Desktop Ansicht (Tabelle) */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left py-3 px-4">Spieler</th>
                                            <th className="text-left py-3 px-4">Ergebnis</th>
                                            <th className="text-left py-3 px-4">Format</th>
                                            <th className="text-left py-3 px-4">Status</th>
                                            <th className="text-left py-3 px-4">Datum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedGames.map((game) => {
                                            // Berechne den aktuellen Spielstand
                                            const player1Sets = game.scores?.filter(score =>
                                                score.player1_score > score.player2_score
                                            ).length || 0;

                                            const player2Sets = game.scores?.filter(score =>
                                                score.player2_score > score.player1_score
                                            ).length || 0;

                                            return (
                                                <tr
                                                    key={game.id}
                                                    className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors"
                                                    onClick={() => router.push(`/games/${game.id}`)}
                                                >
                                                    <td className="py-3 px-4">
                                                        <div>
                                                            <span className={game.winner_id === game.player1_id ? 'font-bold text-primary' : ''}>
                                                                {game.player1?.name || 'Unbekannt'}
                                                            </span>
                                                            {' vs '}
                                                            <span className={game.winner_id === game.player2_id ? 'font-bold text-primary' : ''}>
                                                                {game.player2?.name || 'Unbekannt'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {game.scores && game.scores.length > 0 ? (
                                                            <span className="font-medium">
                                                                {player1Sets} : {player2Sets}
                                                            </span>
                                                        ) : (
                                                            <span className="text-zinc-500">Keine Ergebnisse</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-xs font-medium bg-zinc-800 px-2 py-1 rounded">
                                                            {game.sets_to_win ? `Best of ${game.sets_to_win * 2 - 1}` : 'Best of 5'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {renderStatus(game.status)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {new Date(game.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* "Mehr laden" Button */}
                            {filteredGames.length > displayCount && (
                                <div className="text-center mt-6">
                                    <Button
                                        variant="outline"
                                        onClick={loadMoreGames}
                                        className="w-full md:w-auto"
                                    >
                                        Mehr Spiele laden
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Spielpläne */}
            <div className="mt-10">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <h2 className="text-xl sm:text-2xl font-bold">Spielpläne</h2>
                    <Link href="/games/schedules/new" className="w-full md:w-auto">
                        <Button className="w-full">Neuen Spielplan erstellen</Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Alle Spielpläne</CardTitle>
                        <CardDescription>
                            Hier siehst du alle erstellten Spielpläne.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loadingSchedules ? (
                            <div className="text-center py-8">Lade Spielpläne...</div>
                        ) : schedules.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                                Keine Spielpläne gefunden. Erstelle einen neuen Spielplan!
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Mobile Ansicht (Karten) */}
                                <div className="md:hidden space-y-4">
                                    {displayedSchedules.map((schedule) => (
                                        <div
                                            key={schedule.id}
                                            className="border border-zinc-800 rounded-lg p-4 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                            onClick={() => router.push(`/games/schedules/${schedule.id}`)}
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h3 className="font-semibold">{schedule.name}</h3>
                                                    <div className="text-sm text-zinc-400 mt-1">
                                                        Erstellt am {new Date(schedule.created_at).toLocaleDateString()}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <div className="bg-zinc-800 px-2 py-1 rounded text-xs font-medium">
                                                        {schedule.court_count} {schedule.court_count === 1 ? 'Court' : 'Courts'}
                                                    </div>
                                                    <div className="bg-zinc-800 px-2 py-1 rounded text-xs font-medium">
                                                        {playerCounts[schedule.id] || 0} Spieler
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Desktop Ansicht (Tabelle) */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-zinc-800">
                                                <th className="text-left py-3 px-4">Name</th>
                                                <th className="text-left py-3 px-4">Anzahl Courts</th>
                                                <th className="text-left py-3 px-4">Anzahl Spieler</th>
                                                <th className="text-left py-3 px-4">Datum</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayedSchedules.map((schedule) => (
                                                <tr
                                                    key={schedule.id}
                                                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                                                    onClick={() => router.push(`/games/schedules/${schedule.id}`)}
                                                >
                                                    <td className="py-3 px-4">{schedule.name}</td>
                                                    <td className="py-3 px-4">
                                                        <span className="bg-zinc-800 px-2 py-1 rounded text-xs font-medium">
                                                            {schedule.court_count} {schedule.court_count === 1 ? 'Court' : 'Courts'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="bg-zinc-800 px-2 py-1 rounded text-xs font-medium">
                                                            {playerCounts[schedule.id] || 0} Spieler
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4">{new Date(schedule.created_at).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* "Mehr laden" Button für Spielpläne */}
                                {schedules.length > scheduleDisplayCount && (
                                    <div className="text-center mt-6">
                                        <Button
                                            variant="outline"
                                            onClick={loadMoreSchedules}
                                            className="w-full md:w-auto"
                                        >
                                            Mehr Spielpläne laden
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}