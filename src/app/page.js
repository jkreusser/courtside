'use client';

import { useState, useEffect, useMemo, useCallback, Suspense, useRef } from 'react';
import { supabase, checkConnection, getRankings } from '@/lib/supabase-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area } from 'recharts';
import { Info } from 'lucide-react';

// Chart component with fallback that loads charts more efficiently
const ChartContainer = ({ children }) => (
  <Suspense fallback={<div className="h-64 w-full flex items-center justify-center">Lade Diagramm...</div>}>
    {children}
  </Suspense>
);

// Stabile Ladekomponente, die mindestens X ms angezeigt wird, um Flackern zu vermeiden
const StableLoadingState = ({ isLoading, children, minLoadingTime = 800 }) => {
  const [showLoading, setShowLoading] = useState(isLoading);
  const loadingStartTime = useRef(0);

  useEffect(() => {
    if (isLoading) {
      setShowLoading(true);
      loadingStartTime.current = Date.now();
    } else {
      const loadingElapsed = Date.now() - loadingStartTime.current;
      const remainingLoadTime = Math.max(0, minLoadingTime - loadingElapsed);

      // Verzögere das Ausblenden des Ladebildschirms, wenn noch nicht genug Zeit vergangen ist
      if (remainingLoadTime > 0) {
        const timer = setTimeout(() => {
          setShowLoading(false);
        }, remainingLoadTime);
        return () => clearTimeout(timer);
      } else {
        setShowLoading(false);
      }
    }
  }, [isLoading, minLoadingTime]);

  return showLoading ? (
    <div className="text-center py-8">Lade Spiele...</div>
  ) : children;
};

export default function DashboardPage() {
  const { user, loading: authLoading, connectionStatus, checkConnection: authCheckConnection } = useAuth();
  const router = useRouter();
  const [dashboardState, setDashboardState] = useState({
    players: [],
    games: [],
    loading: false,
    error: null,
    rankings: [],
    playerNames: {},
    recentGames: [],
    recentPlayers: [],
    reconnectAttempts: 0,
    initialLoadComplete: false,
    isLoadingData: false // Zusätzliches Flag für präzisere Ladekontrolle
  });
  const [lastDataUpdate, setLastDataUpdate] = useState(0);
  const loadingTimeoutRef = useRef(null);
  const fetchLockRef = useRef(false); // Neuer Mutex-Mechanismus für Ladeoperationen

  // Destructure state for convenience
  const {
    players, games, loading, error, rankings,
    playerNames, recentGames, recentPlayers, reconnectAttempts,
    initialLoadComplete, isLoadingData
  } = dashboardState;

  // Update state in batches to reduce renders
  const updateDashboardState = useCallback((newState) => {
    setDashboardState(prev => ({ ...prev, ...newState }));
  }, []);

  // Verbindungswiederherstellung (als memoized Funktion)
  const attemptReconnectLocal = useCallback(async () => {
    if (reconnectAttempts > 5) {
      updateDashboardState({
        error: "Maximale Anzahl an Wiederverbindungsversuchen erreicht. Bitte laden Sie die Seite neu."
      });
      return false;
    }

    updateDashboardState({
      reconnectAttempts: reconnectAttempts + 1,
      error: "Versuche, die Verbindung wiederherzustellen..."
    });

    // Kurze Pause vor Wiederverbindung
    await new Promise(r => setTimeout(r, 1000));

    // Verbindung prüfen
    const isConnected = await checkConnection();

    if (isConnected) {
      updateDashboardState({ error: null });
      // Löst nur einen Datenrefresh aus, keine Navigation
      setLastDataUpdate(Date.now());
      return true;
    } else {
      updateDashboardState({
        error: "Verbindung konnte nicht wiederhergestellt werden. Weiterer Versuch in 5 Sekunden..."
      });
      setTimeout(attemptReconnectLocal, 5000);
      return false;
    }
  }, [reconnectAttempts, updateDashboardState]);

  // Combined data fetching function to reduce separate API calls
  const fetchDashboardData = useCallback(async () => {
    if (!user || authLoading) return;

    // Verhindern, dass mehrere Ladeoperationen parallel laufen
    if (fetchLockRef.current || isLoadingData) {
      console.log('Lade-Vorgang bereits aktiv, überspringe...');
      return;
    }

    // Setze Mutex-Lock
    fetchLockRef.current = true;

    // Setze Ladestatus mit verzögerter Anzeige für UI
    if (!initialLoadComplete) {
      // Beim ersten Laden direkt loading=true setzen
      updateDashboardState({ loading: true, isLoadingData: true });
    } else {
      // Bei nachfolgenden Ladungen warten wir kurz, bevor wir den Ladezustand anzeigen
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }

      // Sofort isLoadingData setzen (interne Sperre)
      updateDashboardState({ isLoadingData: true });

      // Verzögert loading=true setzen (UI-Anzeige)
      loadingTimeoutRef.current = setTimeout(() => {
        updateDashboardState({ loading: true });
      }, 500); // Längere Verzögerung um Flackern zu vermeiden
    }

    try {
      // Check connection first
      if (connectionStatus !== 'connected') {
        const isConnected = await authCheckConnection();
        if (!isConnected) {
          // Lade-Timeout löschen, falls vorhanden
          if (loadingTimeoutRef.current) {
            clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = null;
          }

          updateDashboardState({
            error: 'Keine Verbindung zur Datenbank. Versuche, die Verbindung wiederherzustellen...',
            loading: false,
            isLoadingData: false
          });

          // Mutex-Lock freigeben
          fetchLockRef.current = false;

          setTimeout(attemptReconnectLocal, 2000);
          return;
        }
      }

      // Parallel data fetching for speed
      const [gamesResponse, playersResponse, recentGamesResponse, recentPlayersResponse] = await Promise.all([
        // User games - Cache-Header hinzufügen
        supabase
          .from('games')
          .select(`
            *,
            player1:player1_id(*),
            player2:player2_id(*),
            scores(*)
          `)
          .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
          .order('created_at', { ascending: false }),

        // All players
        supabase
          .from('players')
          .select('*'),

        // Recent games (for dashboard)
        supabase
          .from('games')
          .select(`
            id,
            player1_id,
            player2_id,
            status,
            created_at,
            updated_at,
            scores (
              id,
              player1_score,
              player2_score
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5),

        // Recent players
        supabase
          .from('players')
          .select(`
            id,
            name,
            created_at
          `)
          .order('created_at', { ascending: false })
          .limit(5)
      ]);

      // Handle any errors from the responses
      if (gamesResponse.error) throw gamesResponse.error;
      if (playersResponse.error) throw playersResponse.error;
      if (recentGamesResponse.error) throw recentGamesResponse.error;
      if (recentPlayersResponse.error) throw recentPlayersResponse.error;

      // Process player names for all games at once
      const allPlayerIds = new Set();

      // Collect player IDs from all game data
      [...(gamesResponse.data || []), ...(recentGamesResponse.data || [])].forEach(game => {
        if (game.player1_id) allPlayerIds.add(game.player1_id);
        if (game.player2_id) allPlayerIds.add(game.player2_id);
      });

      let namesMap = { ...playerNames }; // Start with existing names

      // If we have new player IDs, fetch them
      if (allPlayerIds.size > 0) {
        const { data: playerNamesData, error: playerNamesError } = await supabase
          .from('players')
          .select('id, name')
          .in('id', Array.from(allPlayerIds));

        if (!playerNamesError && playerNamesData) {
          playerNamesData.forEach(player => {
            namesMap[player.id] = player.name;
          });
        }
      }

      // Process player statistics for rankings
      let playersWithStats = [];

      if (playersResponse.data && playersResponse.data.length > 0) {
        // Get completed games for stats calculation
        const { data: completedGamesData } = await supabase
          .from('games')
          .select(`
              id, 
              player1_id, 
              player2_id, 
              winner_id, 
              status,
              scores(id, player1_score, player2_score)
            `)
          .eq('status', 'completed')
          .limit(100);

        // Calculate stats for each player
        playersWithStats = playersResponse.data.map(player => {
          const playerGames = completedGamesData?.filter(game =>
            game.player1_id === player.id || game.player2_id === player.id
          ) || [];

          const wins = playerGames.filter(game => game.winner_id === player.id).length;
          const totalGames = playerGames.length;
          const winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0;

          // Count won and lost sets
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

        // Sort players 
        playersWithStats.sort((a, b) => {
          if (a.wins !== b.wins) return b.wins - a.wins;
          return b.pointRatio - a.pointRatio;
        });
      }

      // Process recent games with player names
      const processedRecentGames = recentGamesResponse.data?.map(game => ({
        ...game,
        player1_name: namesMap[game.player1_id] || `Spieler ${game.player1_id?.substring(0, 8)}...`,
        player2_name: namesMap[game.player2_id] || `Spieler ${game.player2_id?.substring(0, 8)}...`
      })) || [];

      // Lade-Timeout löschen
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      // Batch update all state in einem einzigen Update
      updateDashboardState({
        games: gamesResponse.data || [],
        players: playersWithStats,
        recentGames: processedRecentGames,
        recentPlayers: recentPlayersResponse.data || [],
        playerNames: namesMap,
        loading: false,
        isLoadingData: false,
        error: null,
        initialLoadComplete: true
      });
    } catch (error) {
      console.error('Fehler beim Laden der Dashboard-Daten:', error);

      // Lade-Timeout löschen
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }

      updateDashboardState({
        error: 'Fehler beim Laden der Daten',
        loading: false,
        isLoadingData: false
      });

      if (!loading) {
        toast.error('Fehler beim Laden der Dashboard-Daten');
      }
    } finally {
      // Mutex-Lock in jedem Fall freigeben
      fetchLockRef.current = false;
    }
  }, [user, authLoading, connectionStatus, playerNames, initialLoadComplete, isLoadingData, loading, authCheckConnection, attemptReconnectLocal, updateDashboardState]);

  // Effect for initial loading and updates for logged-in users
  useEffect(() => {
    if (user && !authLoading) {
      fetchDashboardData();
    }

    // Cleanup-Funktion, um Timeouts zu löschen
    return () => {
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [user, authLoading, lastDataUpdate, fetchDashboardData]);

  // Separate effect for loading rankings for non-logged-in users
  useEffect(() => {
    if (!user && !authLoading) {
      const fetchRankings = async () => {
        updateDashboardState({ loading: true });
        try {
          // Check connection first
          const isConnected = await checkConnection();
          if (!isConnected) {
            updateDashboardState({
              error: 'Keine Verbindung zur Datenbank.',
              loading: false
            });
            return;
          }

          // Hole die Rankings direkt aus der Supabase Client-Funktion, 
          // die bereits Spielernamen enthält und richtige Punktzählung nutzt
          const { data: rankingsData, error: rankingsError } = await supabase
            .from('rankings_view')
            .select('*')
            .order('win_percentage', { ascending: false })
            .limit(5);

          if (rankingsError) {
            console.error('Fehler bei Rankings-Abfrage:', rankingsError);
            // Fallback zur Client-Funktion, wenn die View nicht funktioniert
            const { data: calculatedRankings, error } = await getRankings(false, 5);

            if (error) throw error;

            updateDashboardState({
              rankings: calculatedRankings || [],
              loading: false
            });
            return;
          }

          updateDashboardState({
            rankings: rankingsData || [],
            loading: false
          });
        } catch (err) {
          console.error('Fehler beim Laden der Rangliste:', err);
          updateDashboardState({
            error: 'Fehler beim Laden der Rangliste',
            loading: false
          });
        }
      };

      fetchRankings();
    }
  }, [user, authLoading, updateDashboardState]);

  // Memoized chart data
  const performanceData = useMemo(() => {
    // Wenn kein User oder keine Spiele, leeres Array zurückgeben
    if (!user?.id || !games || games.length < 2) return [];

    return generatePerformanceData(games, user.id);
  }, [games, user?.id]);

  const pointDifferenceData = useMemo(() => {
    return generatePointDifferenceData(games, user?.id);
  }, [games, user?.id]);

  // Handle auth loading with consistent UI
  if (authLoading) {
    return <div className="text-center py-8">Lade...</div>;
  }

  // For non-logged-in users: Welcome page with login button
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
            ) : rankings.length === 0 ? (
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
                        <th className="text-left py-3 px-2 sm:px-4">Winrate</th>
                        <th className="text-left py-3 px-2 sm:px-4">Siege</th>
                        <th className="text-left py-3 px-2 sm:px-4">Spiele</th>
                        <th className="text-left py-3 px-2 sm:px-4">Punkte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankings.slice(0, 5).map((player, index) => (
                        <tr
                          key={player.player_id}
                          className={`${index === 0 ? 'bg-secondary text-white' : 'border-b border-zinc-800'}`}
                        >
                          <td className="py-3 px-2 sm:px-4 font-semibold">
                            {index + 1}
                          </td>
                          <td className="py-3 px-2 sm:px-4">{player.player_name || 'Unbekannt'}</td>
                          <td className="py-3 px-2 sm:px-4 font-mono">
                            {player.win_percentage !== undefined
                              ? `${player.win_percentage.toFixed(1)}%`
                              : '-'}
                          </td>
                          <td className="py-3 px-2 sm:px-4 font-mono">{player.games_won || 0}</td>
                          <td className="py-3 px-2 sm:px-4 font-mono">{player.games_played || 0}</td>
                          <td className="py-3 px-2 sm:px-4 font-mono text-primary">{player.total_points}</td>
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

  // For logged-in users: Dashboard with personal data
  return (
    <div className="space-y-6 sm:space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold">Mein CourtSide</h1>

      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5" />
            <p>{error}</p>
            {connectionStatus === 'disconnected' && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={attemptReconnectLocal}
              >
                Verbindung wiederherstellen
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Meine Spiele</CardTitle>
          <CardDescription>
            Deine aktuellen und vergangenen Spiele.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StableLoadingState isLoading={loading} minLoadingTime={800}>
            {games.length === 0 ? (
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
                    statusBadge = <span className="px-2 py-1 text-xs rounded-full bg-zinc-800 text-white">Geplant</span>;
                  } else if (game.status === 'in_progress') {
                    statusBadge = <span className="px-2 py-1 text-xs rounded-full bg-white text-black">Läuft</span>;
                  } else if (game.status === 'completed') {
                    const hasWon = game.winner_id === user.id;
                    statusBadge = hasWon
                      ? <span className="px-2 py-1 text-xs rounded-full bg-secondary text-primary">Gewonnen</span>
                      : <span className="px-2 py-1 text-xs rounded-full bg-zinc-800 text-white">Verloren</span>;
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
          </StableLoadingState>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Performance Over Time - Win Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Winrate</CardTitle>
            <CardDescription>
              Deine Erfolgsquote pro Spieltag
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {games.length >= 3 && performanceData.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={performanceData}
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
                    domain={[0, 1]} // Fest auf 0% bis 100% setzen
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
                      if (name === 'winrate') return [`${Math.round(value * 100)}%`, 'Winrate'];
                      return [value, name];
                    }}
                    labelStyle={{ color: '#e5e7eb', fontWeight: 'bold', marginBottom: '5px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="winrate"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ stroke: '#10b981', strokeWidth: 2, r: 4, fill: '#1c1c1e' }}
                    activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2, fill: '#10b981' }}
                    name="Winrate"
                    connectNulls={true}
                    animationDuration={500}
                    animationBegin={0}
                    animationEasing="ease-out"
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col h-full items-center justify-center text-center text-zinc-500">
                <p className="mb-2">Noch nicht genügend Spiele für Statistiken.</p>
                <p className="text-sm">Spiele an mindestens zwei Tagen, um deine Winrate zu sehen.</p>
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
            {games.length >= 3 && pointDifferenceData.length >= 3 ? (
              <ChartContainer>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={pointDifferenceData}
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
                      animationDuration={0} // Reduce animation for less flicker
                      animationBegin={0}
                      animationEasing="ease-out"
                      isAnimationActive={false} // Disable animation completely
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
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
  if (!games || !games.length || !userId) return [];

  // Kopie der Spiele erstellen und nach Datum sortieren
  const sortedGames = [...games].sort((a, b) =>
    new Date(a.created_at) - new Date(b.created_at)
  );

  // Wenn weniger als 2 Spiele, leeres Array zurückgeben
  if (sortedGames.length < 2) {
    return [];
  }

  // Gruppiere Spiele nach Datum
  const gamesByDate = {};

  // Nur abgeschlossene Spiele berücksichtigen
  sortedGames.filter(game => game.status === 'completed').forEach(game => {
    // Überspringe Spiele ohne gültiges Datum
    if (!game.created_at) return;

    const gameDate = new Date(game.created_at);
    // Überprüfen, ob das Datum gültig ist
    if (isNaN(gameDate.getTime())) return;

    // Datum auf Tag genau (ohne Uhrzeit)
    const dateKey = gameDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    if (!gamesByDate[dateKey]) {
      gamesByDate[dateKey] = {
        games: [],
        displayDate: gameDate.toLocaleDateString('de-DE', { month: 'short', day: 'numeric' }),
        timestamp: gameDate.getTime() // Für Sortierung
      };
    }

    gamesByDate[dateKey].games.push(game);
  });

  // Sortiere die Tage chronologisch
  const sortedDays = Object.values(gamesByDate).sort((a, b) => a.timestamp - b.timestamp);

  // Wenn weniger als 2 Tage mit Spielen, leeres Array zurückgeben
  if (sortedDays.length < 2) {
    return [];
  }

  // Berechne die Winrate für jeden Tag (nicht kumulativ)
  const chartData = [];

  sortedDays.forEach(dayData => {
    let winsToday = 0;
    let gamesToday = 0;

    // Berechne Gewinne und Spiele für diesen Tag
    dayData.games.forEach(game => {
      gamesToday++;
      if (game.winner_id === userId) {
        winsToday++;
      }
    });

    // Nur Tage mit mindestens einem Spiel hinzufügen
    if (gamesToday > 0) {
      // Berechne die Winrate für diesen Tag
      const winrate = parseFloat((winsToday / gamesToday).toFixed(2));

      // Füge Datenpunkt hinzu
      chartData.push({
        date: dayData.displayDate,
        winrate: winrate,
        spiele: gamesToday
      });
    }
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
  const chartData = sortedGames.map((game, index) => {
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

  // Stelle sicher, dass mindestens drei Datenpunkte vorhanden sind
  if (chartData.length < 3) {
    const lastPoint = chartData[chartData.length - 1];
    while (chartData.length < 3) {
      chartData.push({
        ...lastPoint,
        gameNumber: chartData.length + 1,
        punkteDifferenz: lastPoint.punkteDifferenz,
        datum: 'Heute'
      });
    }
  }

  return chartData;
}
