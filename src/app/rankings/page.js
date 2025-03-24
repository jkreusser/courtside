'use client';

import { useState, useEffect } from 'react';
import { getRankings, getDailyRankings } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Select, SelectOption } from '@/components/ui/Select';
import toast from 'react-hot-toast';
import { format, subDays } from 'date-fns';
import { de } from 'date-fns/locale';

export default function RankingsPage() {
    const [allTimeRankings, setAllTimeRankings] = useState([]);
    const [dailyRankings, setDailyRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [availableDates, setAvailableDates] = useState([]);

    // Lade Ranglisten
    useEffect(() => {
        const fetchRankings = async () => {
            try {
                setLoading(true);

                // Lade die Gesamtrangliste mit optimierter Funktion
                const { data: allTimeData, error: allTimeError } = await getRankings();

                if (allTimeError) {
                    console.error('Fehler beim Laden der All-Time-Rangliste:', allTimeError);
                    toast.error('Fehler beim Laden der All-Time-Rangliste');
                } else {
                    setAllTimeRankings(allTimeData || []);
                }

                // Generiere Daten für die letzten 30 Tage für die Auswahl
                const dates = [];
                for (let i = 0; i < 30; i++) {
                    const date = subDays(new Date(), i);
                    dates.push(format(date, 'yyyy-MM-dd'));
                }
                setAvailableDates(dates);

                // Lade tägliches Ranking für den ausgewählten Tag
                await fetchDailyRanking(selectedDate);
            } catch (error) {
                console.error('Ein Fehler ist aufgetreten:', error);
                toast.error('Ein Fehler ist aufgetreten beim Laden der Ranglisten');
            } finally {
                setLoading(false);
            }
        };

        fetchRankings();
    }, [selectedDate]); // Wichtig: selectedDate als Abhängigkeit hinzufügen

    // Lade tägliches Ranking für einen bestimmten Tag mit Fehlerwiederholung
    const fetchDailyRanking = async (date) => {
        let retryCount = 0;
        const maxRetries = 3;
        const retryDelay = 1000; // 1 Sekunde Verzögerung zwischen Versuchen

        const attemptFetch = async () => {
            try {
                setLoading(true);
                const { data, error } = await getDailyRankings(date);

                if (error) {
                    if (retryCount < maxRetries) {
                        console.warn(`Fehler beim Laden des täglichen Rankings. Wiederhole (${retryCount + 1}/${maxRetries})...`);
                        retryCount++;
                        await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
                        return attemptFetch();
                    }

                    console.error('Fehler beim Laden des täglichen Rankings:', error);
                    toast.error('Fehler beim Laden des täglichen Rankings');
                    setDailyRankings([]);
                } else {
                    setDailyRankings(data || []);
                }
            } catch (error) {
                if (retryCount < maxRetries) {
                    console.warn(`Unerwarteter Fehler. Wiederhole (${retryCount + 1}/${maxRetries})...`);
                    retryCount++;
                    await new Promise(resolve => setTimeout(resolve, retryDelay * retryCount));
                    return attemptFetch();
                }

                console.error('Fehler beim Laden des täglichen Rankings:', error);
                toast.error('Fehler beim Laden des täglichen Rankings');
                setDailyRankings([]);
            } finally {
                setLoading(false);
            }
        };

        await attemptFetch();
    };

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
                        ) : allTimeRankings.length === 0 ? (
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
                                        {allTimeRankings.map((player, index) => (
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