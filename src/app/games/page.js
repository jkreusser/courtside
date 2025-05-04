'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

// Wrapper-Komponente, die den Suspense-Boundary nutzt
function GamesPageContent() {
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
        let isMounted = true;
        let retryTimeout;

        const fetchGames = async () => {
            if (!user) return;

            try {
                setLoading(true);

                // Optimierte Spiele-Abfrage mit Limitierung und spezifischer Attributselektion
                const PAGE_SIZE = 20;
                const { data, error } = await supabase
                    .from('games')
                    .select(`
                        id, 
                        status, 
                        created_at,
                        player1_id, 
                        player2_id, 
                        winner_id,
                        sets_to_win,
                        player1:player1_id(id, name),
                        player2:player2_id(id, name),
                        scores(id, player1_score, player2_score)
                    `)
                    .order('created_at', { ascending: false })
                    .range(0, PAGE_SIZE - 1)
                    .throwOnError(); // Wirft einen Fehler bei Datenbankfehlern

                if (error) {
                    throw error;
                }

                if (isMounted) {
                    setGames(data || []);
                }
            } catch (error) {
                console.error('Fehler beim Laden der Spiele:', error);
                toast.error('Fehler beim Laden der Spiele');

                // Wiederholungsversuch mit exponentieller Verzögerung
                let retryCount = 0;
                const maxRetries = 5;
                const retryWithBackoff = async () => {
                    if (retryCount >= maxRetries || !isMounted) return;

                    retryCount++;
                    const delay = 1000 * Math.pow(2, retryCount - 1) * (0.5 + Math.random() * 0.5);

                    await new Promise(resolve => setTimeout(resolve, delay));

                    try {
                        const { data: retryData, error: retryError } = await supabase
                            .from('games')
                            .select(`
                                id, 
                                status, 
                                created_at,
                                player1_id, 
                                player2_id, 
                                winner_id,
                                sets_to_win,
                                player1:player1_id(id, name),
                                player2:player2_id(id, name),
                                scores(id, player1_score, player2_score)
                            `)
                            .order('created_at', { ascending: false })
                            .range(0, PAGE_SIZE - 1)
                            .throwOnError();

                        if (!retryError && isMounted) {
                            setGames(retryData || []);
                            setLoading(false);
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

        const fetchSchedules = async () => {
            if (!user) return;

            try {
                setLoadingSchedules(true);

                // Optimierte Spielplan-Abfrage
                const { data: schedulesData, error: schedulesError } = await supabase
                    .from('schedules')
                    .select('id, name, created_at, court_count')
                    .order('created_at', { ascending: false })
                    .throwOnError();

                if (schedulesError) {
                    throw schedulesError;
                }

                if (isMounted) {
                    setSchedules(schedulesData || []);
                }

                // Lade die Anzahl der Spieler pro Spielplan in einem Batch
                const counts = {};
                if (schedulesData && schedulesData.length > 0) {
                    const scheduleIds = schedulesData.map(s => s.id);

                    const { data: matchesData, error: matchesError } = await supabase
                        .from('schedule_matches')
                        .select('schedule_id, player1_id, player2_id')
                        .in('schedule_id', scheduleIds)
                        .throwOnError();

                    if (!matchesError && matchesData) {
                        // Berechne die Anzahl der Spieler pro Spielplan
                        matchesData.forEach(match => {
                            if (!counts[match.schedule_id]) {
                                counts[match.schedule_id] = new Set();
                            }
                            if (match.player1_id) counts[match.schedule_id].add(match.player1_id);
                            if (match.player2_id) counts[match.schedule_id].add(match.player2_id);
                        });

                        // Konvertiere Sets zu Zahlen
                        Object.keys(counts).forEach(scheduleId => {
                            counts[scheduleId] = counts[scheduleId].size;
                        });

                        if (isMounted) {
                            setPlayerCounts(counts);
                        }
                    }
                }
            } catch (error) {
                console.error('Unerwarteter Fehler beim Laden der Spielpläne:', error);
                toast.error('Fehler beim Laden der Spielpläne');
            } finally {
                if (isMounted) {
                    setLoadingSchedules(false);
                }
            }
        };

        if (user && !authLoading) {
            fetchGames();
            fetchSchedules();
        }

        return () => {
            isMounted = false;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
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
            return <span className="text-xs font-medium px-2 py-1 rounded-full bg-white text-black">Läuft</span>;
        } else {
            return <span className="text-xs font-medium px-2 py-1 rounded-full bg-zinc-800 text-white">Geplant</span>;
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
                                                    {game.scores && game.scores.length > 0 && game.status !== 'completed' ? (
                                                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-white text-black">Läuft</span>
                                                    ) : (
                                                        renderStatus(game.status)
                                                    )}
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
                                                <div className="font-medium">
                                                    {game.scores && game.scores.length > 0 ? (
                                                        <div className="font-mono text-sm text-right">
                                                            {game.scores.map((score, index) => (
                                                                <div key={index} className="mb-1">
                                                                    <span className={score.player1_score > score.player2_score ? 'text-primary font-medium' : ''}>
                                                                        {score.player1_score}
                                                                    </span>
                                                                    :
                                                                    <span className={score.player2_score > score.player1_score ? 'text-primary font-medium' : ''}>
                                                                        {score.player2_score}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
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
                                                            <div className="font-mono text-sm">
                                                                {game.scores.map((score, index) => (
                                                                    <div key={index} className="mb-1">
                                                                        <span className={score.player1_score > score.player2_score ? 'text-primary font-medium' : ''}>
                                                                            {score.player1_score}
                                                                        </span>
                                                                        :
                                                                        <span className={score.player2_score > score.player1_score ? 'text-primary font-medium' : ''}>
                                                                            {score.player2_score}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
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
                                                        {game.scores && game.scores.length > 0 && game.status !== 'completed' ? (
                                                            <span className="text-xs font-medium px-2 py-1 rounded-full bg-white text-black">Läuft</span>
                                                        ) : (
                                                            renderStatus(game.status)
                                                        )}
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

// Haupt-Export-Komponente mit Suspense-Boundary
export default function GamesPage() {
    return (
        <Suspense fallback={<div className="text-center py-12">Spiele werden geladen...</div>}>
            <GamesPageContent />
        </Suspense>
    );
}