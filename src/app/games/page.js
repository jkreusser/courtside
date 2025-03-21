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
    const [filter, setFilter] = useState('all'); // 'all', 'active', 'completed'

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

                // Lade alle Spiele mit Spielerinformationen
                const { data, error } = await supabase
                    .from('games')
                    .select(`
                        *,
                        player1:player1_id(*),
                        player2:player2_id(*),
                        scores(*)
                    `)
                    .order('created_at', { ascending: false });

                if (error) {
                    throw error;
                }

                setGames(data || []);
            } catch (error) {
                toast.error('Fehler beim Laden der Spiele');
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        if (user && !authLoading) {
            fetchGames();
        }
    }, [user, authLoading]);

    // Gefilterte Spiele basierend auf dem ausgewählten Filter
    const filteredGames = games.filter(game => {
        if (filter === 'active') return game.status === 'in_progress';
        if (filter === 'completed') return game.status === 'completed';
        return true; // 'all'
    });

    if (authLoading) {
        return <div className="text-center py-8">Authentifizierung lädt...</div>;
    }

    if (!user) {
        return null;
    }

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

    return (
        <div className="space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-2xl sm:text-3xl font-bold">Alle Spiele</h1>
                <div className="flex items-center">
                    <Link href="/games/new">
                        <Button className="w-full sm:w-auto">Neues Spiel starten</Button>
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
                                {filteredGames.map((game) => {
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
                                        <tr className="border-b">
                                            <th className="text-left py-3 px-4">Spieler</th>
                                            <th className="text-left py-3 px-4">Ergebnis</th>
                                            <th className="text-left py-3 px-4">Format</th>
                                            <th className="text-left py-3 px-4">Status</th>
                                            <th className="text-left py-3 px-4">Datum</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredGames.map((game) => {
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
                                                    className="border-b hover:bg-zinc-800/50 cursor-pointer transition-colors"
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
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}