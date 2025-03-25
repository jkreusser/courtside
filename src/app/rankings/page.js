'use client';

import { useState, useEffect, Suspense } from 'react';
import { getRankings, getDailyRankings } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Select, SelectOption } from '@/components/ui/Select';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function RankingsContent() {
    const [allTimeRankings, setAllTimeRankings] = useState([]);
    const [dailyRankings, setDailyRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [availableDates, setAvailableDates] = useState([]);
    const [playerNames, setPlayerNames] = useState({});
    const [rankings, setRankings] = useState([]);
    const router = useRouter();

    useEffect(() => {
        let isMounted = true;
        let retryTimeout;

        const fetchRankings = async () => {
            try {
                setLoading(true);

                // Generiere Daten für die letzten 30 Tage für die Auswahl
                const dates = [];
                for (let i = 0; i < 30; i++) {
                    const date = subDays(new Date(), i);
                    dates.push(format(date, 'yyyy-MM-dd'));
                }
                if (isMounted) {
                    setAvailableDates(dates);
                }

                // Optimierte Rankings-Abfrage mit spezifischer Feldauswahl
                const { data: rankingsData, error: rankingsError } = await getRankings();

                if (rankingsError) {
                    throw rankingsError;
                }

                // Optimierte Tagesrankings-Abfrage mit spezifischer Feldauswahl
                const { data: dailyRankingsData, error: dailyRankingsError } = await getDailyRankings(selectedDate);

                if (dailyRankingsError) {
                    throw dailyRankingsError;
                }

                if (isMounted) {
                    // Sammle einzigartige Spieler-IDs
                    const playerIds = new Set();
                    rankingsData.forEach(ranking => {
                        if (ranking.player_id) playerIds.add(ranking.player_id);
                    });
                    dailyRankingsData.forEach(ranking => {
                        if (ranking.player_id) playerIds.add(ranking.player_id);
                    });

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

                                // Verarbeite die Rankings-Daten erst nachdem die Spielernamen geladen wurden
                                const processedRankings = rankingsData.map((ranking, index) => ({
                                    ...ranking,
                                    rank: index + 1,
                                    player_name: namesMap[ranking.player_id] || `Spieler ${ranking.player_id.substring(0, 8)}...`
                                }));

                                // Verarbeite die Tagesrankings-Daten
                                const processedDailyRankings = dailyRankingsData.map(ranking => ({
                                    ...ranking,
                                    player_name: namesMap[ranking.player_id] || `Spieler ${ranking.player_id.substring(0, 8)}...`
                                }));

                                setRankings(processedRankings);
                                setDailyRankings(processedDailyRankings);
                            }
                        }
                    } else {
                        // Wenn keine Spieler-IDs vorhanden sind, verarbeite die Daten trotzdem
                        const processedRankings = rankingsData.map((ranking, index) => ({
                            ...ranking,
                            rank: index + 1,
                            player_name: `Spieler ${ranking.player_id.substring(0, 8)}...`
                        }));

                        const processedDailyRankings = dailyRankingsData.map(ranking => ({
                            ...ranking,
                            player_name: `Spieler ${ranking.player_id.substring(0, 8)}...`
                        }));

                        if (isMounted) {
                            setRankings(processedRankings);
                            setDailyRankings(processedDailyRankings);
                        }
                    }
                }
            } catch (error) {
                console.error('Fehler beim Laden der Rankings:', error);
                // Toast nur anzeigen, wenn es sich nicht um einen Auth-Fehler handelt
                if (!error.message?.includes('auth')) {
                    toast.error('Fehler beim Laden der Rankings');
                }

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
                        // Wiederhole die Rankings-Abfrage
                        const { data: retryRankingsData, error: retryRankingsError } = await getRankings();

                        if (retryRankingsError) {
                            throw retryRankingsError;
                        }

                        // Wiederhole die Tagesrankings-Abfrage
                        const { data: retryDailyRankingsData, error: retryDailyRankingsError } = await getDailyRankings(selectedDate);

                        if (retryDailyRankingsError) {
                            throw retryDailyRankingsError;
                        }

                        if (isMounted) {
                            // Sammle einzigartige Spieler-IDs
                            const playerIds = new Set();
                            retryRankingsData.forEach(ranking => {
                                if (ranking.player_id) playerIds.add(ranking.player_id);
                            });
                            retryDailyRankingsData.forEach(ranking => {
                                if (ranking.player_id) playerIds.add(ranking.player_id);
                            });

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

                            // Verarbeite die Rankings-Daten
                            const processedRankings = retryRankingsData.map((ranking, index) => ({
                                ...ranking,
                                rank: index + 1,
                                player_name: playerNames[ranking.player_id] || `Spieler ${ranking.player_id.substring(0, 8)}...`
                            }));

                            // Verarbeite die Tagesrankings-Daten
                            const processedDailyRankings = retryDailyRankingsData.map(ranking => ({
                                ...ranking,
                                player_name: playerNames[ranking.player_id] || `Spieler ${ranking.player_id.substring(0, 8)}...`
                            }));

                            setRankings(processedRankings);
                            setDailyRankings(processedDailyRankings);
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

        fetchRankings();

        return () => {
            isMounted = false;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [router, selectedDate]);

    // Behandle Änderung des ausgewählten Datums
    const handleDateChange = async (e) => {
        const date = e.target.value;
        setSelectedDate(date);
    };

    // Formatiere Datum als lesbaren String
    const formatDate = (dateString) => {
        return format(new Date(dateString), 'PPP', { locale: de });
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold">Ranglisten</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* All-Time-Rangliste */}
                <Card>
                    <CardHeader>
                        <CardTitle>All-Time-Rangliste</CardTitle>
                        <CardDescription>
                            Die Gesamtrangliste basierend auf allen gespielten Spielen.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8">Lade Rangliste...</div>
                        ) : rankings.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                                Noch keine Spielergebnisse vorhanden.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left py-3 px-4">Rang</th>
                                            <th className="text-left py-3 px-4">Spieler</th>
                                            <th className="text-left py-3 px-4">Winrate</th>
                                            <th className="text-left py-3 px-4">Siege</th>
                                            <th className="text-left py-3 px-4">Spiele</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rankings.map((player, index) => (
                                            <tr
                                                key={player.player_id}
                                                className={`border-b border-zinc-800 ${index === 0 ? 'bg-secondary text-white' : ''}`}
                                            >
                                                <td className="py-3 px-4 font-semibold">
                                                    {index + 1}
                                                </td>
                                                <td className="py-3 px-4">{player.player_name}</td>
                                                <td className="py-3 px-4 font-mono text-primary">
                                                    {player.win_percentage !== undefined ? `${player.win_percentage.toFixed(1)}%` : '0.0%'}
                                                </td>
                                                <td className="py-3 px-4 font-mono">{player.games_won || 0}</td>
                                                <td className="py-3 px-4 font-mono">{player.games_played || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Tagesrangliste */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tagesrangliste</CardTitle>
                        <CardDescription>
                            Die Rangliste für einen bestimmten Tag.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-6">
                            <label className="block text-sm font-medium mb-2">
                                Wähle ein Datum:
                            </label>
                            <Select
                                value={selectedDate}
                                onChange={handleDateChange}
                                className="w-full"
                            >
                                {availableDates.map(date => (
                                    <SelectOption key={date} value={date}>
                                        {formatDate(date)}
                                    </SelectOption>
                                ))}
                            </Select>
                        </div>

                        {loading ? (
                            <div className="text-center py-8">Lade Rangliste...</div>
                        ) : dailyRankings.length === 0 ? (
                            <div className="text-center py-8 text-zinc-500">
                                Keine Spielergebnisse für diesen Tag vorhanden.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left py-3 px-4">Rang</th>
                                            <th className="text-left py-3 px-4">Spieler</th>
                                            <th className="text-left py-3 px-4">Winrate</th>
                                            <th className="text-left py-3 px-4">Siege</th>
                                            <th className="text-left py-3 px-4">Spiele</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dailyRankings.map((player, index) => (
                                            <tr
                                                key={player.player_id}
                                                className={`border-b border-zinc-800 ${index === 0 && dailyRankings.length > 1 ? 'bg-secondary text-white' : ''}`}
                                            >
                                                <td className="py-3 px-4 font-semibold">
                                                    {index + 1}
                                                </td>
                                                <td className="py-3 px-4">{player.player_name}</td>
                                                <td className="py-3 px-4 font-mono text-primary">
                                                    {player.win_percentage !== undefined ? `${player.win_percentage.toFixed(1)}%` : '0.0%'}
                                                </td>
                                                <td className="py-3 px-4 font-mono">{player.games_won || 0}</td>
                                                <td className="py-3 px-4 font-mono">{player.games_played || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="p-6 rounded-lg mt-8 border border-zinc-800">
                <h2 className="text-xl font-semibold mb-4">Ranglisten-Information</h2>
                <ul className="list-disc list-inside space-y-2">
                    <li>Die Rangliste wird nach <span className="text-primary font-semibold">Winrate</span> sortiert</li>
                    <li>Bei gleicher Winrate entscheidet die <span className="font-semibold">Anzahl der Siege</span></li>
                    <li>Die Winrate wird berechnet als: <span className="font-semibold">Siege / Gespielte Spiele × 100%</span></li>
                </ul>
            </div>
        </div>
    );
}

export default function RankingsPage() {
    return (
        <Suspense fallback={<div className="text-center py-12">Ranglisten werden geladen...</div>}>
            <RankingsContent />
        </Suspense>
    );
} 