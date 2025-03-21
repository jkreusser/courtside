'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Wenn angemeldet, lade Spiele des Benutzers
  useEffect(() => {
    const fetchGames = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Lade alle Spiele, an denen der Benutzer teilnimmt
        const { data, error } = await supabase
          .from('games')
          .select(`
            *,
            player1:player1_id(*),
            player2:player2_id(*),
            scores(*)
          `)
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
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

  // Lade die Top-Spieler für die Rangliste
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        setLoading(true);
        setError(null);

        // Lade alle Spieler - ohne Benutzerabhängigkeit
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*');

        if (playersError) {
          console.error('Fehler beim Laden der Spieler:', JSON.stringify(playersError));
          setError(`Spieler konnten nicht geladen werden: ${playersError.message || 'Unbekannter Fehler'}`);
          setPlayers([]);
          return;
        }

        // Wenn keine Spieler vorhanden sind, einfach leeres Array zurückgeben
        if (!playersData || playersData.length === 0) {
          setPlayers([]);
          return;
        }

        try {
          // Versuche, die abgeschlossenen Spiele zu laden - ohne Benutzerabhängigkeit
          const { data: gamesData, error: gamesError } = await supabase
            .from('games')
            .select(`
              *,
              scores(*)
            `)
            .eq('status', 'completed');

          // Wenn es einen Fehler gibt oder keine Spiele existieren, zeige nur die Spieler an
          if (gamesError) {
            console.warn('Fehler beim Laden der Spiele:', JSON.stringify(gamesError));
            setPlayers(playersData.map(player => ({
              ...player,
              games: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
              wonSets: 0,
              lostSets: 0,
              pointRatio: 0
            })));
            return;
          }

          if (!gamesData || gamesData.length === 0) {
            console.log('Keine Spiele gefunden');
            setPlayers(playersData.map(player => ({
              ...player,
              games: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
              wonSets: 0,
              lostSets: 0,
              pointRatio: 0
            })));
            return;
          }

          // Berechne Statistiken für jeden Spieler
          const playersWithStats = playersData.map(player => {
            const playerGames = gamesData.filter(game =>
              game.player1_id === player.id || game.player2_id === player.id
            );

            const wins = playerGames.filter(game => game.winner_id === player.id).length;
            const totalGames = playerGames.length;
            const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

            // Zähle gewonnene und verlorene Sätze
            let wonSets = 0;
            let lostSets = 0;

            playerGames.forEach(game => {
              if (!game.scores || !Array.isArray(game.scores)) return;

              const isPlayer1 = game.player1_id === player.id;

              game.scores.forEach(score => {
                if (isPlayer1) {
                  if (score.player1_score > score.player2_score) {
                    wonSets++;
                  } else if (score.player1_score < score.player2_score) {
                    lostSets++;
                  }
                } else {
                  if (score.player2_score > score.player1_score) {
                    wonSets++;
                  } else if (score.player2_score < score.player1_score) {
                    lostSets++;
                  }
                }
              });
            });

            // Berechne Punkteverhältnis
            const pointRatio = lostSets > 0 ? wonSets / lostSets : wonSets > 0 ? Infinity : 0;

            return {
              ...player,
              games: totalGames,
              wins,
              losses: totalGames - wins,
              winRate,
              wonSets,
              lostSets,
              pointRatio
            };
          });

          // Sortiere Spieler nach Siege, dann nach Punkteverhältnis
          const sortedPlayers = playersWithStats.sort((a, b) => {
            if (a.wins !== b.wins) {
              return b.wins - a.wins; // Absteigend nach Siegen
            }
            return b.pointRatio - a.pointRatio; // Absteigend nach Punkteverhältnis
          });

          setPlayers(sortedPlayers);
        } catch (gameError) {
          console.error('Fehler bei der Verarbeitung der Spiele:', gameError);
          // Fallback: Zeige nur die Spieler ohne Statistik an
          setPlayers(playersData.map(player => ({
            ...player,
            games: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            wonSets: 0,
            lostSets: 0,
            pointRatio: 0
          })));
        }
      } catch (error) {
        console.error('Unerwarteter Fehler beim Laden der Rangliste:', error);
        setError('Die Rangliste konnte nicht geladen werden');
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlayers();
  }, []);

  if (authLoading) {
    return <div className="text-center py-8">Lade...</div>;
  }

  // Für nicht angemeldete Benutzer: Willkommensseite mit Login-Button
  if (!user) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <div className="rounded-lg relative overflow-hidden" style={{
          backgroundImage: 'url("/images/hero.webp")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          minHeight: '400px',
        }}>
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/90 to-secondary/70"></div>
          <div className="relative z-10 p-6 sm:p-12 flex flex-col h-full justify-center">
            <h1 className="text-3xl sm:text-5xl font-bold mb-4 text-white max-w-2xl">Willkommen bei <span className="text-white">Court</span><span className="text-primary">Side</span></h1>
            <p className="text-lg sm:text-xl max-w-xl text-zinc-100 mb-6 sm:mb-8">
              Organisiere Spiele, trage Ergebnisse ein und verfolge deine Fortschritte in der Rangliste.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link href="/login" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">Jetzt anmelden</Button>
              </Link>
              <Link href="/rankings" className="w-full sm:w-auto">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">Rangliste ansehen</Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 my-6 sm:my-12">
          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-2 sm:pb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                </svg>
              </div>
              <CardTitle>Profilübersicht</CardTitle>
              <CardDescription>Verfolge deine Statistiken und Erfolge</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm sm:text-base">Sieh dir deine Spielhistorie, Erfolgsquote und persönliche Leistungsentwicklung an.</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-2 sm:pb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0" />
                </svg>
              </div>
              <CardTitle>Achievements</CardTitle>
              <CardDescription>Schalte besondere Erfolge frei</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm sm:text-base">Verdiene dir Auszeichnungen basierend auf deinen Leistungen und Erfolgen im Spiel.</p>
            </CardContent>
          </Card>

          <Card className="border-t-4 border-t-primary">
            <CardHeader className="pb-2 sm:pb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <CardTitle>Spielverwaltung</CardTitle>
              <CardDescription>Erstelle und verwalte Spiele</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm sm:text-base">Plane Spiele, trage Ergebnisse ein und halte den Überblick über deine Spielhistorie.</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top Spieler</CardTitle>
            <CardDescription>
              Die aktuell besten Spieler in der Rangliste.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Lade Rangliste...</div>
            ) : error ? (
              <div className="text-center py-8 text-red-600">{error}</div>
            ) : players.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                Noch keine Spieler verfügbar.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-zinc-800">
                        <th className="text-left py-3 px-2 sm:px-4">Rang</th>
                        <th className="text-left py-3 px-2 sm:px-4">Spieler</th>
                        <th className="text-left py-3 px-2 sm:px-4">Spiele</th>
                        <th className="text-left py-3 px-2 sm:px-4">Siege</th>
                        <th className="text-left py-3 px-2 sm:px-4">Siegrate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {players.slice(0, 5).map((player, index) => (
                        <tr
                          key={player.id}
                          className={`${index === 0 ? 'bg-secondary text-white' : 'border-b border-zinc-800'}`}
                        >
                          <td className="py-3 px-2 sm:px-4 font-semibold">
                            {index + 1}
                          </td>
                          <td className="py-3 px-2 sm:px-4">{player.name || 'Unbekannt'}</td>
                          <td className="py-3 px-2 sm:px-4 font-mono">{player.games}</td>
                          <td className="py-3 px-2 sm:px-4 font-mono">{player.wins}</td>
                          <td className="py-3 px-2 sm:px-4 font-mono">
                            {player.games > 0
                              ? `${Math.round(player.winRate)}%`
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Für angemeldete Benutzer: Dashboard mit persönlichen Daten
  return (
    <div className="space-y-6 sm:space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold">Mein CourtSide</h1>

      <Card>
        <CardHeader>
          <CardTitle>Meine Spiele</CardTitle>
          <CardDescription>
            Deine aktuellen und vergangenen Spiele.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Lade Spiele...</div>
          ) : games.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-500 mb-4">Du hast noch keine Spiele.</p>
              <Link href="/games/new">
                <Button className="w-full sm:w-auto">Neues Spiel erstellen</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {games.slice(0, 3).map((game) => {
                const isPlayer1 = game.player1_id === user.id;
                const opponent = isPlayer1 ? game.player2 : game.player1;
                const score = game.scores && game.scores.length > 0
                  ? game.scores.map((set) => `${isPlayer1 ? set.player1_score : set.player2_score}:${isPlayer1 ? set.player2_score : set.player1_score}`).join(', ')
                  : 'Noch kein Ergebnis';

                let statusBadge;
                if (game.status === 'scheduled') {
                  statusBadge = <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Geplant</span>;
                } else if (game.status === 'in_progress') {
                  statusBadge = <span className="px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-800">Läuft</span>;
                } else if (game.status === 'completed') {
                  const hasWon = game.winner_id === user.id;
                  statusBadge = hasWon
                    ? <span className="px-2 py-1 text-xs rounded-full bg-secondary text-primary">Gewonnen</span>
                    : <span className="px-2 py-1 text-xs rounded-full bg-red-900 text-red-100">Verloren</span>;
                }

                return (
                  <Link href={`/games/${game.id}`} key={game.id} className="block">
                    <div className="border border-zinc-800 rounded-md p-3 sm:p-4 hover:border-zinc-600 hover:bg-zinc-900/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-2 sm:gap-4">
                        <div>
                          <h3 className="font-semibold text-base sm:text-lg mb-1">
                            Gegen {opponent && opponent.name ? opponent.name : 'Unbekannt'}
                          </h3>
                          <div className="text-xs sm:text-sm text-zinc-400">
                            {new Date(game.created_at).toLocaleDateString('de-DE')}
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-normal sm:space-x-4">
                          <div className="text-sm font-mono">{score}</div>
                          {statusBadge}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}

              <div className="text-center mt-6 space-y-2 sm:space-y-0 sm:space-x-2">
                <Link href="/games" className="block sm:inline-block w-full sm:w-auto">
                  <Button variant="outline" className="w-full sm:w-auto">Alle Spiele anzeigen</Button>
                </Link>
                <Link href="/games/new" className="block sm:inline-block w-full sm:w-auto mt-2 sm:mt-0">
                  <Button className="w-full sm:w-auto">Neues Spiel erstellen</Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Performance Over Time - Win Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Siegrate</CardTitle>
            <CardDescription>
              Deine Erfolgsquote im Zeitverlauf
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {games.length > 3 && generatePerformanceData(games, user.id).length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={generatePerformanceData(games, user.id)}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <defs>
                    <filter id="shadow" height="200%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.1" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    axisLine={{ stroke: '#4b5563' }}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    axisLine={{ stroke: '#4b5563' }}
                    tickFormatter={(value) => `${Math.round(value * 100)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1c1e',
                      borderColor: '#2c2c2e',
                      borderRadius: '8px',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                      color: '#e5e7eb'
                    }}
                    itemStyle={{ color: '#e5e7eb' }}
                    formatter={(value, name) => {
                      if (name === 'siegRate') return [`${Math.round(value * 100)}%`, 'Siegrate'];
                      return [value, name];
                    }}
                    labelStyle={{ color: '#e5e7eb', fontWeight: 'bold', marginBottom: '5px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="siegRate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ stroke: '#10b981', strokeWidth: 2, r: 4, fill: '#1c1c1e' }}
                    activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2, fill: '#10b981' }}
                    name="Siegrate"
                    filter="url(#shadow)"
                    fillOpacity={0.3}
                    fill="#0A100E"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-center text-zinc-500">
                <p className="mb-2">Noch nicht genügend Spiele für Statistiken.</p>
                <p className="text-sm">Spiele mindestens 3 Spiele, um deine Erfolgsquote zu sehen.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Point Difference Over Time */}
        <Card>
          <CardHeader>
            <CardTitle>Punktedifferenz</CardTitle>
            <CardDescription>
              Deine durchschnittliche Punktedifferenz pro Satz
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {games.length > 3 && generatePointDifferenceData(games, user.id).length > 1 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={generatePointDifferenceData(games, user.id)}
                  margin={{ top: 10, right: 20, left: 10, bottom: 10 }}
                >
                  <defs>
                    <filter id="shadow" height="200%">
                      <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.1" />
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
                  <XAxis
                    dataKey="gameNumber"
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    axisLine={{ stroke: '#4b5563' }}
                    label={{ value: 'Spiel #', position: 'insideBottomRight', offset: -5, fill: '#9ca3af' }}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={{ stroke: '#4b5563' }}
                    axisLine={{ stroke: '#4b5563' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1c1c1e',
                      borderColor: '#2c2c2e',
                      borderRadius: '8px',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
                      color: '#e5e7eb'
                    }}
                    itemStyle={{ color: '#e5e7eb' }}
                    formatter={(value, name) => {
                      if (name === 'punkteDifferenz') return [value, 'Punktedifferenz'];
                      return [value, name];
                    }}
                    labelFormatter={(value) => `Spiel #${value}`}
                    labelStyle={{ color: '#e5e7eb', fontWeight: 'bold', marginBottom: '5px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="punkteDifferenz"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ stroke: '#10b981', strokeWidth: 2, r: 4, fill: '#1c1c1e' }}
                    activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2, fill: '#10b981' }}
                    name="Punktedifferenz"
                    filter="url(#shadow)"
                    fillOpacity={0.3}
                    fill="#0A100E"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-center text-zinc-500">
                <p className="mb-2">Noch nicht genügend Spiele für Statistiken.</p>
                <p className="text-sm">Spiele mindestens 3 Spiele, um deine Punktedifferenz zu sehen.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Funktion zur Generierung der Performance-Daten
function generatePerformanceData(games, userId) {
  if (!games || !games.length) return [];

  // Spiele nach Datum sortieren
  const sortedGames = [...games].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  // Gruppiere Spiele nach Spielsessions (oder Tagen bei weniger Spielen)
  const useWeekly = sortedGames.length > 14; // Bei mehr als 14 Spielen gruppieren wir nach Wochen

  // Wenn es weniger als 3 eindeutige Tage gibt, gruppiere nach Sessions
  const uniqueDays = new Set(sortedGames.map(game =>
    new Date(game.created_at).toISOString().split('T')[0]
  )).size;

  const useSessionGrouping = uniqueDays < 2;

  // Spiele nach Zeitperioden gruppieren
  const gamesByPeriod = {};

  sortedGames.forEach((game, index) => {
    const gameDate = new Date(game.created_at);
    let periodKey;

    if (useSessionGrouping) {
      // Bei nur einem Spieltag: Gruppiere je 3 Spiele zu einer Session
      const sessionGroup = Math.floor(index / 3);
      periodKey = `session-${sessionGroup}`;
    } else if (useWeekly) {
      // Wochenbasierte Gruppierung
      const year = gameDate.getFullYear();
      const weekNumber = getWeekNumber(gameDate);
      periodKey = `${year}-W${weekNumber}`;
    } else {
      // Tagesbasierte Gruppierung
      periodKey = gameDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD
    }

    if (!gamesByPeriod[periodKey]) {
      gamesByPeriod[periodKey] = {
        games: [],
        periodStart: gameDate,
        displayDate: useSessionGrouping
          ? `Session ${Math.floor(index / 3) + 1}`
          : useWeekly
            ? `KW${getWeekNumber(gameDate)}`
            : gameDate.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' })
      };
    }

    gamesByPeriod[periodKey].games.push(game);
  });

  // Sortiere die Perioden chronologisch
  const sortedPeriods = Object.values(gamesByPeriod).sort((a, b) =>
    a.periodStart - b.periodStart
  );

  // Erstelle die Daten für das Diagramm
  const chartData = [];
  let cumulativePointDiff = 0;

  sortedPeriods.forEach((period, idx) => {
    // Berechne die Statistiken für diese Periode
    let wins = 0;
    let gamesInPeriod = 0;
    let periodPointDiff = 0;

    period.games.forEach(game => {
      gamesInPeriod++;

      // Berechne, ob der aktuelle Nutzer gewonnen hat
      const isWinner = game.winner_id === userId;
      if (isWinner) wins++;

      // Berechne Punktedifferenz für den aktuellen Spieler
      if (game.scores && game.scores.length) {
        const isPlayer1 = game.player1_id === userId;

        game.scores.forEach(score => {
          if (isPlayer1) {
            periodPointDiff += score.player1_score - score.player2_score;
          } else {
            periodPointDiff += score.player2_score - score.player1_score;
          }
        });
      }
    });

    // Berechne die Siegrate für diese Periode
    const periodWinRate = gamesInPeriod > 0 ? wins / gamesInPeriod : 0;

    // Berechne die durchschnittliche Punktedifferenz pro Spiel für diese Periode
    const avgPointDiff = gamesInPeriod > 0 ? periodPointDiff / gamesInPeriod : 0;

    // Kumuliere die Punktedifferenz für den Trend
    cumulativePointDiff += periodPointDiff;

    // Füge die Daten für diese Periode zum Chart hinzu
    chartData.push({
      date: period.displayDate,
      siegRate: periodWinRate,
      punkteDifferenz: Math.round(avgPointDiff),
      spiele: gamesInPeriod,
      kumulativ: chartData.length > 0
        ? chartData[chartData.length - 1].kumulativ + periodPointDiff
        : periodPointDiff
    });
  });

  return chartData;
}

// Hilfsfunktion zur Berechnung der Kalenderwoche
function getWeekNumber(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Funktion zur Generierung der Punktedifferenz-Daten nach Spielzahl
function generatePointDifferenceData(games, userId) {
  if (!games || !games.length) return [];

  // Spiele nach Datum sortieren
  const sortedGames = [...games].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  // Erstelle die Daten für das Diagramm
  return sortedGames.map((game, index) => {
    // Berechne Punktedifferenz für den aktuellen Spieler
    let pointDiff = 0;
    if (game.scores && game.scores.length) {
      const isPlayer1 = game.player1_id === userId;

      game.scores.forEach(score => {
        if (isPlayer1) {
          pointDiff += score.player1_score - score.player2_score;
        } else {
          pointDiff += score.player2_score - score.player1_score;
        }
      });
    }

    return {
      gameNumber: index + 1,
      punkteDifferenz: pointDiff,
      datum: new Date(game.created_at).toLocaleDateString('de-DE', {
        month: 'short',
        day: 'numeric'
      })
    };
  });
}
