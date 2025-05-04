'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function GameDetailPage({ params }) {
    // Nutze React.use() um params auszupacken
    const id = React.use(params).id;
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [game, setGame] = useState(null);
    const [players, setPlayers] = useState({ player1: null, player2: null });
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isParticipant, setIsParticipant] = useState(false);
    const [newScore, setNewScore] = useState({ player1_score: '', player2_score: '' });
    const [addingScore, setAddingScore] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Leite zur Login-Seite weiter, wenn der Benutzer nicht angemeldet ist
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Lade Spieldetails
    useEffect(() => {
        let isMounted = true;
        let retryTimeout;

        const fetchGame = async () => {
            if (!user) return;

            try {
                setLoading(true);

                // Optimierte Spieleabfrage mit spezifischer Feldauswahl
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
                        scores(
                            id,
                            player1_score,
                            player2_score,
                            created_at
                        )
                    `)
                    .eq('id', id)
                    .single()
                    .throwOnError();

                if (error) {
                    throw error;
                }

                if (!data) {
                    toast.error('Spiel nicht gefunden');
                    router.push('/games');
                    return;
                }

                if (isMounted) {
                    setGame(data);
                    setPlayers({
                        player1: data.player1,
                        player2: data.player2
                    });

                    // Sortiere Ergebnisse nach Erstellungsdatum
                    const sortedScores = data.scores ?
                        [...data.scores].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) :
                        [];
                    setScores(sortedScores);

                    // Überprüfe, ob der aktuelle Benutzer ein Teilnehmer des Spiels ist
                    const userIsParticipant = user.id === data.player1_id || user.id === data.player2_id;
                    setIsParticipant(userIsParticipant);
                }
            } catch (error) {
                console.error('Fehler beim Laden des Spiels:', error);
                toast.error('Fehler beim Laden des Spiels');

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
                                scores(
                                    id,
                                    player1_score,
                                    player2_score,
                                    created_at
                                )
                            `)
                            .eq('id', id)
                            .single()
                            .throwOnError();

                        if (!retryError && retryData && isMounted) {
                            setGame(retryData);
                            setPlayers({
                                player1: retryData.player1,
                                player2: retryData.player2
                            });

                            const sortedScores = retryData.scores ?
                                [...retryData.scores].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) :
                                [];
                            setScores(sortedScores);

                            const userIsParticipant = user.id === retryData.player1_id || user.id === retryData.player2_id;
                            setIsParticipant(userIsParticipant);
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
            fetchGame();
        }

        return () => {
            isMounted = false;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [id, user, authLoading, router]);

    // Füge ein neues Ergebnis hinzu
    const handleAddScore = async (e) => {
        e.preventDefault();

        // Validiere die Eingaben
        const player1Score = parseInt(newScore.player1_score);
        const player2Score = parseInt(newScore.player2_score);

        if (isNaN(player1Score) || isNaN(player2Score)) {
            toast.error('Bitte gib gültige Zahlen ein');
            return;
        }

        if (player1Score < 0 || player2Score < 0) {
            toast.error('Punkte können nicht negativ sein');
            return;
        }

        // Berechne die maximale Anzahl der Sätze
        const setsToWin = game.sets_to_win || 3;
        const maxSets = setsToWin * 2 - 1; // Best of 5 = 5 Sätze, Best of 3 = 3 Sätze, Best of 1 = 1 Satz

        // Überprüfe, ob die maximale Anzahl der Sätze bereits erreicht ist
        if (scores.length >= maxSets) {
            toast.error(`Das Spiel kann maximal ${maxSets} Sätze haben`);
            return;
        }

        try {
            setLoading(true);

            // Füge das neue Ergebnis hinzu
            const { data, error } = await supabase
                .from('scores')
                .insert([
                    {
                        game_id: id,
                        player1_score: player1Score,
                        player2_score: player2Score
                    }
                ])
                .select()
                .single()
                .throwOnError();

            if (error) {
                throw error;
            }

            // Aktualisiere den lokalen State
            setScores(prevScores => [...prevScores, data].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));

            // Setze das Formular zurück
            setNewScore({ player1_score: '', player2_score: '' });

            // Überprüfe, ob das Spiel beendet ist
            const player1Sets = scores.filter(score => score.player1_score > score.player2_score).length + (player1Score > player2Score ? 1 : 0);
            const player2Sets = scores.filter(score => score.player2_score > score.player1_score).length + (player2Score > player1Score ? 1 : 0);

            // Beende das Spiel, wenn ein Spieler die erforderlichen Sätze gewonnen hat oder die maximale Anzahl der Sätze erreicht wurde
            if (player1Sets >= setsToWin || player2Sets >= setsToWin || scores.length + 1 >= maxSets) {
                // Ermittle den Gewinner (bei maximaler Satzanzahl ist es der Spieler mit mehr gewonnenen Sätzen)
                const winnerId = player1Sets > player2Sets ? game.player1_id : game.player2_id;

                // Aktualisiere den Spielstatus
                const { error: updateError } = await supabase
                    .from('games')
                    .update({
                        status: 'completed',
                        winner_id: winnerId
                    })
                    .eq('id', id)
                    .throwOnError();

                if (updateError) {
                    console.error('🏁 Fehler beim Aktualisieren des Spielstatus:', updateError);
                    throw updateError;
                }

                // Aktualisiere den lokalen State
                setGame(prev => ({
                    ...prev,
                    status: 'completed',
                    winner_id: winnerId
                }));

                // Überprüfe und schalte Achievements frei
                await checkAchievements(winnerId);

                toast.success('Spiel beendet!');
            }

            toast.success('Ergebnis hinzugefügt!');
        } catch (error) {
            console.error('Fehler beim Hinzufügen des Ergebnisses:', error);
            toast.error('Fehler beim Hinzufügen des Ergebnisses');
        } finally {
            setLoading(false);
        }
    };

    // Funktion zum Überprüfen und Freischalten von Achievements
    const checkAchievements = async (winnerId) => {
        try {
            // Falls der aktuelle Benutzer der Gewinner ist
            if (user.id === winnerId) {
                // Überprüfen, ob der Benutzer bereits das "first_win" Achievement hat
                const { data: firstWinData, error: firstWinError } = await supabase
                    .from('player_achievements')
                    .select('achievement_id')
                    .eq('player_id', user.id)
                    .eq('achievement_id', 'first_win');

                if (firstWinError) {
                    console.error('Fehler beim Prüfen des first_win Achievements:', firstWinError);
                } else if (!firstWinData || firstWinData.length === 0) {
                    // Freischalten des "first_win" Achievements, wenn es noch nicht existiert
                    const { error: unlockError } = await supabase
                        .from('player_achievements')
                        .insert({
                            player_id: user.id,
                            achievement_id: 'first_win',
                            achieved_at: new Date().toISOString()
                        });

                    if (unlockError) {
                        console.error('Fehler beim Freischalten des first_win Achievements:', unlockError);
                    } else {
                        toast.success('Achievement freigeschaltet: Erster Sieg!', { duration: 5000 });
                    }
                }

                // Überprüfen von Siegesserien (streak) und Spielanzahl (matches)
                await checkStreakAndMatchesAchievements();

                // Überprüfen des "Perfect Match" Achievements
                await checkPerfectMatchAchievement();

                // Überprüfen des "Comeback King" Achievements
                await checkComebackKingAchievement();

                // Überprüfen des "Win Streak Breaker" Achievements
                await checkWinStreakBreakerAchievement();
            }

            // Überprüfung für Tagessieger-Achievement (unabhängig davon, wer gewonnen hat)
            await checkDailyWinnerAchievement(winnerId);

            // Überprüfung für Underdog-Achievement (Wenn ein niedriger platzierter Spieler einen höher platzierten besiegt)
            await checkUnderdogAchievement(winnerId);
        } catch (error) {
            console.error('Fehler bei der Achievement-Überprüfung:', error);
        }
    };

    // Funktion zum Überprüfen von Siegesserien und Spielanzahl
    const checkStreakAndMatchesAchievements = async () => {
        try {
            // Hole alle Spiele des Benutzers
            const { data: userGames, error: gamesError } = await supabase
                .from('games')
                .select('*')
                .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
                .order('created_at', { ascending: false })
                .eq('status', 'completed');

            if (gamesError) {
                throw gamesError;
            }

            if (!userGames || userGames.length === 0) return;

            // Überprüfe Spielanzahl-Achievements
            const totalGames = userGames.length;

            // Liste der möglichen Spielanzahl-Achievements
            const matchesAchievements = [
                { id: 'matches_10', threshold: 10 },
                { id: 'matches_25', threshold: 25 },
                { id: 'matches_50', threshold: 50 }
            ];

            // Überprüfe für jedes Spielanzahl-Achievement
            for (const achievement of matchesAchievements) {
                if (totalGames >= achievement.threshold) {
                    // Prüfe, ob das Achievement bereits freigeschaltet ist
                    const { data: achievementData, error: achievementError } = await supabase
                        .from('player_achievements')
                        .select('achievement_id')
                        .eq('player_id', user.id)
                        .eq('achievement_id', achievement.id);

                    if (achievementError) {
                        console.error(`Fehler beim Prüfen des ${achievement.id} Achievements:`, achievementError);
                        continue;
                    }

                    // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
                    if (!achievementData || achievementData.length === 0) {
                        const { error: unlockError } = await supabase
                            .from('player_achievements')
                            .insert({
                                player_id: user.id,
                                achievement_id: achievement.id,
                                achieved_at: new Date().toISOString()
                            });

                        if (unlockError) {
                            console.error(`Fehler beim Freischalten des ${achievement.id} Achievements:`, unlockError);
                        } else {
                            let achievementName;
                            switch (achievement.id) {
                                case 'matches_10': achievementName = 'Anfänger'; break;
                                case 'matches_25': achievementName = 'Enthusiast'; break;
                                case 'matches_50': achievementName = 'CourtSide-Veteran'; break;
                            }
                            toast.success(`Achievement freigeschaltet: ${achievementName}!`, { duration: 5000 });
                        }
                    }
                }
            }

            // Überprüfe Siegesserien-Achievements
            let currentStreak = 0;

            // Berechne aktuelle Siegesserie
            for (const game of userGames) {
                const isWinner = game.winner_id === user.id;

                if (isWinner) {
                    currentStreak++;
                } else {
                    break; // Bei erster Niederlage ist die Serie beendet
                }
            }

            // Liste der möglichen Siegesserien-Achievements
            const streakAchievements = [
                { id: 'streak_3', threshold: 3, name: 'Siegesserie' },
                { id: 'streak_5', threshold: 5, name: 'Unaufhaltsam' },
                { id: 'streak_10', threshold: 10, name: 'Dominator' }
            ];

            // Überprüfe für jedes Siegesserien-Achievement
            for (const achievement of streakAchievements) {
                if (currentStreak >= achievement.threshold) {
                    // Prüfe, ob das Achievement bereits freigeschaltet ist
                    const { data: achievementData, error: achievementError } = await supabase
                        .from('player_achievements')
                        .select('achievement_id')
                        .eq('player_id', user.id)
                        .eq('achievement_id', achievement.id);

                    if (achievementError) {
                        console.error(`Fehler beim Prüfen des ${achievement.id} Achievements:`, achievementError);
                        continue;
                    }

                    // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
                    if (!achievementData || achievementData.length === 0) {
                        const { error: unlockError } = await supabase
                            .from('player_achievements')
                            .insert({
                                player_id: user.id,
                                achievement_id: achievement.id,
                                achieved_at: new Date().toISOString()
                            });

                        if (unlockError) {
                            console.error(`Fehler beim Freischalten des ${achievement.id} Achievements:`, unlockError);
                        } else {
                            toast.success(`Achievement freigeschaltet: ${achievement.name}!`, { duration: 5000 });
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Fehler bei der Überprüfung von Streak- und Matches-Achievements:', error);
        }
    };

    // Funktion zum Überprüfen des Tagessieger-Achievements
    const checkDailyWinnerAchievement = async (winnerId) => {
        try {
            // Falls der aktuelle Benutzer nicht der Gewinner ist, nichts tun
            if (user.id !== winnerId) return;

            const today = new Date();
            const dateStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

            // Prüfe, ob das Achievement für den VORTAG freigeschaltet werden soll
            // Berechne das Datum des Vortags
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];

            // Hole alle GESTERN abgeschlossenen Spiele
            const { data: yesterdaysGames, error: gamesError } = await supabase
                .from('games')
                .select('*')
                .eq('status', 'completed')
                .gte('updated_at', `${yesterdayStr}T00:00:00`)
                .lte('updated_at', `${yesterdayStr}T23:59:59`);

            if (gamesError) {
                throw gamesError;
            }

            if (!yesterdaysGames || yesterdaysGames.length === 0) return;

            // Berechne die Punkte pro Spieler für den VORTAG
            const playerPoints = {};

            for (const game of yesterdaysGames) {
                if (game.winner_id) {
                    playerPoints[game.winner_id] = (playerPoints[game.winner_id] || 0) + 1;
                }
            }

            // Sortiere Spieler nach Punkten
            const sortedPlayers = Object.entries(playerPoints).sort((a, b) => b[1] - a[1]);

            // Wenn der aktuelle Benutzer der Spieler mit den meisten Punkten am VORTAG war
            if (sortedPlayers.length > 0 && sortedPlayers[0][0] === user.id) {
                // Prüfe, ob das Achievement bereits für den Vortag freigeschaltet ist
                const { data: achievementData, error: achievementError } = await supabase
                    .from('player_achievements')
                    .select('achievement_id, achieved_at')
                    .eq('player_id', user.id)
                    .eq('achievement_id', 'daily_winner');

                if (achievementError) {
                    console.error('Fehler beim Prüfen des daily_winner Achievements:', achievementError);
                    return;
                }

                // Überprüfe, ob das Achievement bereits für den Vortag freigeschaltet wurde
                const alreadyAchievedForYesterday = achievementData && achievementData.some(achievement => {
                    const achievedDate = new Date(achievement.achieved_at).toISOString().split('T')[0];
                    return achievedDate === yesterdayStr || achievedDate === dateStr; // Auch heutiges Datum prüfen (falls es am nächsten Tag freigeschaltet wurde)
                });

                // Wenn das Achievement für den Vortag noch nicht freigeschaltet wurde
                if (!alreadyAchievedForYesterday) {
                    const { error: unlockError } = await supabase
                        .from('player_achievements')
                        .insert({
                            player_id: user.id,
                            achievement_id: 'daily_winner',
                            achieved_at: new Date().toISOString()
                        });

                    if (unlockError) {
                        console.error('Fehler beim Freischalten des daily_winner Achievements:', unlockError);
                    } else {
                        toast.success('Achievement freigeschaltet: Tagessieg für gestern!', { duration: 5000 });
                    }
                }
            }
        } catch (error) {
            console.error('Fehler bei der Überprüfung des Tagessieger-Achievements:', error);
        }
    };

    // Funktion zum Überprüfen des Underdog-Achievements
    const checkUnderdogAchievement = async (winnerId) => {
        try {
            // Falls der aktuelle Benutzer nicht der Gewinner ist, nichts tun
            if (user.id !== winnerId) return;

            const opponentId = game.player1_id === winnerId ? game.player2_id : game.player1_id;

            // Alternative Methode zur Bestimmung der Spielerstärke ohne get_rankings
            // Holt die Siege jedes Spielers
            const { data: winnerGames, error: winnerError } = await supabase
                .from('games')
                .select('*')
                .eq('status', 'completed')
                .eq('winner_id', winnerId);

            const { data: opponentGames, error: opponentError } = await supabase
                .from('games')
                .select('*')
                .eq('status', 'completed')
                .eq('winner_id', opponentId);

            if (winnerError) {
                console.error('Fehler beim Abrufen der Spiele des Gewinners:', winnerError);
                return;
            }

            if (opponentError) {
                console.error('Fehler beim Abrufen der Spiele des Gegners:', opponentError);
                return;
            }

            // Berechne die Siegesrate für beide Spieler
            const winnerWins = winnerGames?.length || 0;
            const opponentWins = opponentGames?.length || 0;

            // Hole die Gesamtzahl der Spiele für jeden Spieler
            const { data: winnerTotal, error: winnerTotalError } = await supabase
                .from('games')
                .select('count')
                .or(`player1_id.eq.${winnerId},player2_id.eq.${winnerId}`)
                .eq('status', 'completed');

            const { data: opponentTotal, error: opponentTotalError } = await supabase
                .from('games')
                .select('count')
                .or(`player1_id.eq.${opponentId},player2_id.eq.${opponentId}`)
                .eq('status', 'completed');

            if (winnerTotalError || opponentTotalError) {
                console.error('Fehler beim Abrufen der Gesamtspiele:', winnerTotalError || opponentTotalError);
                return;
            }

            const winnerTotalGames = winnerTotal?.length > 0 ? parseInt(winnerTotal[0].count) : 0;
            const opponentTotalGames = opponentTotal?.length > 0 ? parseInt(opponentTotal[0].count) : 0;

            // Berechne den Rang basierend auf der Siegesrate und der Anzahl der Spiele
            // Ein höherer Wert bedeutet einen stärkeren Spieler
            const winnerRating = winnerTotalGames > 0 ? winnerWins / winnerTotalGames : 0;
            const opponentRating = opponentTotalGames > 0 ? opponentWins / opponentTotalGames : 0;

            // Der Gewinner ist ein Underdog, wenn sein Rating niedriger ist als das des Gegners
            // UND der Gegner hatte mindestens 3 Spiele gespielt (um Zufall auszuschließen)
            if (winnerRating < opponentRating && opponentTotalGames >= 3) {
                // Prüfe, ob das Achievement bereits freigeschaltet ist
                const { data: achievementData, error: achievementError } = await supabase
                    .from('player_achievements')
                    .select('achievement_id')
                    .eq('player_id', user.id)
                    .eq('achievement_id', 'underdog');

                if (achievementError) {
                    console.error('Fehler beim Prüfen des underdog Achievements:', achievementError);
                    return;
                }

                // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
                if (!achievementData || achievementData.length === 0) {
                    const { error: unlockError } = await supabase
                        .from('player_achievements')
                        .insert({
                            player_id: user.id,
                            achievement_id: 'underdog',
                            achieved_at: new Date().toISOString()
                        });

                    if (unlockError) {
                        console.error('Fehler beim Freischalten des underdog Achievements:', unlockError);
                    } else {
                        toast.success('Achievement freigeschaltet: Underdog!', { duration: 5000 });
                    }
                }
            }
        } catch (error) {
            // Verbesserte Fehlerbehandlung für leere Fehlerobjekte
            if (error && Object.keys(error).length === 0) {
                console.error('Fehler bei der Überprüfung des Underdog-Achievements: Leeres Fehlerobjekt');
            } else if (error === null || error === undefined) {
                console.error('Fehler bei der Überprüfung des Underdog-Achievements: Kein Fehlerobjekt vorhanden');
            } else {
                console.error('Fehler bei der Überprüfung des Underdog-Achievements:',
                    JSON.stringify(error, Object.getOwnPropertyNames(error)));
            }
        }
    };

    // Funktion zum Überprüfen des "Perfect Match" Achievements
    const checkPerfectMatchAchievement = async () => {
        try {
            // Prüfe, ob es sich um ein perfektes Spiel handelt (kein verlorener Punkt)
            const isPerfectMatch = scores.every(score => {
                const isPlayer1 = game.player1_id === user.id;
                const playerScore = isPlayer1 ? score.player1_score : score.player2_score;
                const opponentScore = isPlayer1 ? score.player2_score : score.player1_score;

                // Ein perfektes Spiel bedeutet, dass der Gegner in keinem Satz einen Punkt erzielt hat
                return opponentScore === 0 && playerScore > 0;
            });

            // Wenn es kein perfektes Spiel ist oder keine Sätze gespielt wurden, abbrechen
            if (!isPerfectMatch || scores.length === 0) return;

            // Prüfe, ob das Achievement bereits freigeschaltet ist
            const { data: achievementData, error: achievementError } = await supabase
                .from('player_achievements')
                .select('achievement_id')
                .eq('player_id', user.id)
                .eq('achievement_id', 'perfect_match');

            if (achievementError) {
                console.error('Fehler beim Prüfen des perfect_match Achievements:', achievementError);
                return;
            }

            // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
            if (!achievementData || achievementData.length === 0) {
                const { error: unlockError } = await supabase
                    .from('player_achievements')
                    .insert({
                        player_id: user.id,
                        achievement_id: 'perfect_match',
                        achieved_at: new Date().toISOString()
                    });

                if (unlockError) {
                    console.error('Fehler beim Freischalten des perfect_match Achievements:', unlockError);
                } else {
                    toast.success('Achievement freigeschaltet: Perfektes Spiel!', { duration: 5000 });
                }
            }
        } catch (error) {
            console.error('Fehler bei der Überprüfung des Perfect Match Achievements:', error);
        }
    };

    // Funktion zum Überprüfen des "Comeback King" Achievements
    const checkComebackKingAchievement = async () => {
        try {
            // Mindestens 5 Sätze benötigt für einen 0:2 Comeback (Best-of-5)
            if (scores.length < 3) {
                return;
            }

            // Sortiere Sätze nach Erstellungszeit, um sie in der richtigen Reihenfolge zu haben
            const sortedScores = [...scores].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

            // Prüfe, ob die ersten beiden Sätze verloren wurden
            const isPlayer1 = game.player1_id === user.id;

            // Prüfe die ersten beiden Sätze
            const firstTwoSetsLost = sortedScores.length >= 2 &&
                sortedScores.slice(0, 2).every(score => {
                    const playerScore = isPlayer1 ? score.player1_score : score.player2_score;
                    const opponentScore = isPlayer1 ? score.player2_score : score.player1_score;
                    return playerScore < opponentScore;
                });

            // Prüfe, ob das Spiel trotzdem gewonnen wurde
            if (!firstTwoSetsLost) {
                return;
            }

            // Prüfe, ob das Achievement bereits freigeschaltet ist
            const { data: achievementData, error: achievementError } = await supabase
                .from('player_achievements')
                .select('achievement_id')
                .eq('player_id', user.id)
                .eq('achievement_id', 'comeback_king');

            if (achievementError) {
                console.error('Fehler beim Prüfen des comeback_king Achievements:', achievementError);
                return;
            }

            // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
            if (!achievementData || achievementData.length === 0) {
                const { error: unlockError } = await supabase
                    .from('player_achievements')
                    .insert({
                        player_id: user.id,
                        achievement_id: 'comeback_king',
                        achieved_at: new Date().toISOString()
                    });

                if (unlockError) {
                    console.error('Fehler beim Freischalten des comeback_king Achievements:', unlockError);
                } else {
                    toast.success('Achievement freigeschaltet: Comeback-König!', { duration: 5000 });
                }
            }
        } catch (error) {
            console.error('Fehler bei der Überprüfung des Comeback King Achievements:', error);
        }
    };

    // Funktion zum Überprüfen des "Win Streak Breaker" Achievements
    const checkWinStreakBreakerAchievement = async () => {
        try {
            // Bestimme die ID des Gegners (Verlierer)
            const opponentId = game.player1_id === user.id ? game.player2_id : game.player1_id;

            // Hole alle Spiele des Gegners vor diesem Spiel
            const { data: opponentGames, error: gamesError } = await supabase
                .from('games')
                .select('*')
                .or(`player1_id.eq.${opponentId},player2_id.eq.${opponentId}`)
                .lt('created_at', game.created_at)  // Nur Spiele vor diesem
                .order('created_at', { ascending: false })  // Neueste zuerst
                .eq('status', 'completed');

            if (gamesError) {
                console.error('Fehler beim Abrufen der Gegner-Spiele:', gamesError);
                return;
            }

            if (!opponentGames || opponentGames.length === 0) {
                return;
            }

            // Berechne die Siegesserie des Gegners vor diesem Spiel
            let streak = 0;

            for (const g of opponentGames) {
                if (g.winner_id === opponentId) {
                    streak++;
                } else {
                    break; // Siegesserie endet bei Niederlage
                }
            }

            // Prüfe, ob die Siegesserie mindestens 5 war
            if (streak < 5) {
                return;
            }

            // Prüfe, ob das Achievement bereits freigeschaltet ist
            const { data: achievementData, error: achievementError } = await supabase
                .from('player_achievements')
                .select('achievement_id')
                .eq('player_id', user.id)
                .eq('achievement_id', 'win_streak_breaker');

            if (achievementError) {
                console.error('Fehler beim Prüfen des win_streak_breaker Achievements:', achievementError);
                return;
            }

            // Wenn das Achievement noch nicht freigeschaltet ist, schalte es frei
            if (!achievementData || achievementData.length === 0) {
                const { error: unlockError } = await supabase
                    .from('player_achievements')
                    .insert({
                        player_id: user.id,
                        achievement_id: 'win_streak_breaker',
                        achieved_at: new Date().toISOString()
                    });

                if (unlockError) {
                    console.error('Fehler beim Freischalten des win_streak_breaker Achievements:', unlockError);
                } else {
                    toast.success('Achievement freigeschaltet: Serienkiller!', { duration: 5000 });
                }
            }
        } catch (error) {
            console.error('Fehler bei der Überprüfung des Win Streak Breaker Achievements:', error);
        }
    };

    // Funktion zum Löschen des Spiels
    const deleteGame = async () => {
        if (!confirm('Möchtest du dieses Spiel wirklich löschen?')) {
            return;
        }

        try {
            setIsDeleting(true);

            // Lösche die player_achievements, die mit diesem Spiel verbunden sein könnten
            const { error: achievementsError } = await supabase
                .from('player_achievements')
                .delete()
                .in('achievement_id', ['first_win', 'underdog', 'streak_3', 'streak_5', 'streak_10', 'daily_winner'])
                .eq('player_id', user.id)
                .gt('achieved_at', new Date(game.created_at).toISOString());

            if (achievementsError) {
                console.error('Fehler beim Löschen der Achievements:', achievementsError);
            }

            // Lösche zuerst die Ergebnisse
            const { error: scoresError } = await supabase
                .from('scores')
                .delete()
                .eq('game_id', id);

            if (scoresError) {
                console.error('Fehler beim Löschen der Ergebnisse:', scoresError);
                throw scoresError;
            }

            // Lösche dann das Spiel
            const { error: gameError } = await supabase
                .from('games')
                .delete()
                .eq('id', id);

            if (gameError) {
                console.error('Fehler beim Löschen des Spiels:', gameError);
                throw gameError;
            }

            toast.success('Spiel erfolgreich gelöscht');

            // Direkte Navigation statt Timeout
            window.location.href = '/games';
        } catch (error) {
            toast.error('Fehler beim Löschen des Spiels');
            console.error('Fehler beim Löschen des Spiels:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    if (authLoading) {
        return <div className="text-center py-8">Authentifizierung lädt...</div>;
    }

    // Wir brauchen diese Überprüfung nicht mehr, da wir bereits durch useEffect zur Login-Seite weiterleiten
    if (!user) {
        return <div className="text-center py-8">Lade Benutzerdaten...</div>;
    }

    if (loading) {
        return <div className="text-center py-8">Lade Spieldetails...</div>;
    }

    if (!game) {
        return <div className="text-center py-8">Spiel nicht gefunden</div>;
    }

    // Berechne den aktuellen Spielstand
    const player1Sets = scores.filter(score => score.player1_score > score.player2_score).length;
    const player2Sets = scores.filter(score => score.player2_score > score.player1_score).length;

    return (
        <div className="space-y-8">
            {/* Mobile Layout */}
            <div className="flex flex-row items-center justify-between md:hidden">
                <h1 className="text-2xl font-bold truncate pr-2">Spieldetails</h1>
                {isParticipant && (
                    <button
                        onClick={deleteGame}
                        className="p-2 rounded-md text-white hover:text-white hover:bg-zinc-800 flex items-center justify-center"
                        title="Spiel löschen"
                        aria-label="Spiel löschen"
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
                )}
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:flex md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-3xl font-bold truncate">Spieldetails</h1>
                <div className="flex items-center gap-2">
                    <Link href="/games">
                        <Button variant="secondary">Zurück zur Spieleübersicht</Button>
                    </Link>
                    {isParticipant && (
                        <Button
                            variant="destructive"
                            onClick={deleteGame}
                            className="w-11 h-11 !p-2 flex items-center justify-center hover:bg-white/10"
                            title="Spiel löschen"
                            aria-label="Spiel löschen"
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
                    )}
                </div>
            </div>

            {/* Mobile Button */}
            <div className="md:hidden mb-4">
                <Link href="/games" className="w-full">
                    <Button variant="secondary" className="w-full">Zurück zur Spieleübersicht</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Gegner</CardTitle>
                    <CardDescription>
                        Spieler in diesem Match
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="flex flex-col items-center p-4 border rounded-lg">
                            <h3 className="text-lg font-medium">{players.player1?.name}</h3>
                            {game.winner_id === players.player1?.id && (
                                <span className="mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                                    Gewinner
                                </span>
                            )}
                        </div>
                        <div className="flex flex-col items-center p-4 border rounded-lg">
                            <h3 className="text-lg font-medium">{players.player2?.name}</h3>
                            {game.winner_id === players.player2?.id && (
                                <span className="mt-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                                    Gewinner
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <div className="text-4xl font-bold">
                            {player1Sets} : {player2Sets}
                        </div>
                        <p className="mt-2 text-zinc-500">Aktuelle Sätze</p>
                        <div className="mt-2 flex flex-col items-center">
                            <div className="text-sm font-medium">
                                {game.sets_to_win ? `Best of ${game.sets_to_win * 2 - 1}` : 'Best of 5'}
                            </div>
                            <div className="mt-1 w-64 h-2 bg-zinc-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-primary"
                                    style={{
                                        width: `${Math.min(100, (Math.max(player1Sets, player2Sets) / (game.sets_to_win || 3)) * 100)}%`
                                    }}
                                ></div>
                            </div>
                            <div className="mt-1 text-xs text-zinc-500">
                                {game.status === 'completed' ? (
                                    game.winner_id === players.player1?.id ? (
                                        `${players.player1?.name} hat gewonnen!`
                                    ) : (
                                        `${players.player2?.name} hat gewonnen!`
                                    )
                                ) : (
                                    player1Sets > player2Sets
                                        ? `${players.player1?.name} braucht noch ${(game.sets_to_win || 3) - player1Sets} ${(game.sets_to_win || 3) - player1Sets === 1 ? 'Satz' : 'Sätze'} zum Sieg`
                                        : player2Sets > player1Sets
                                            ? `${players.player2?.name} braucht noch ${(game.sets_to_win || 3) - player2Sets} ${(game.sets_to_win || 3) - player2Sets === 1 ? 'Satz' : 'Sätze'} zum Sieg`
                                            : `${players.player1?.name} und ${players.player2?.name} brauchen noch ${(game.sets_to_win || 3) - player1Sets} ${(game.sets_to_win || 3) - player1Sets === 1 ? 'Satz' : 'Sätze'} zum Sieg`
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Ergebnisse</CardTitle>
                    <CardDescription>
                        {game.status === 'completed'
                            ? 'Das Spiel ist abgeschlossen.'
                            : 'Hier kannst du die Ergebnisse der Sätze einsehen und neue hinzufügen.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {scores.length === 0 ? (
                        <div className="text-center py-8 text-zinc-500">
                            Noch keine Ergebnisse eingetragen.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-zinc-800">
                                        <th className="text-left py-3 px-4">Satz</th>
                                        <th className="text-left py-3 px-4">{players.player1?.name}</th>
                                        <th className="text-left py-3 px-4">{players.player2?.name}</th>
                                        <th className="text-left py-3 px-4">Datum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scores.map((score, index) => (
                                        <tr key={score.id} className="border-b border-zinc-800">
                                            <td className="py-3 px-4">{index + 1}</td>
                                            <td className="py-3 px-4 font-medium">
                                                {score.player1_score}
                                                {score.player1_score > score.player2_score && (
                                                    <span className="ml-2 text-primary">✓</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 font-medium">
                                                {score.player2_score}
                                                {score.player2_score > score.player1_score && (
                                                    <span className="ml-2 text-primary">✓</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">{new Date(score.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Formular zum Hinzufügen eines neuen Ergebnisses (nur für Teilnehmer und wenn das Spiel nicht abgeschlossen ist) */}
                    {isParticipant && game.status !== 'completed' && (
                        <form onSubmit={handleAddScore} className="mt-8">
                            <h3 className="text-lg font-medium mb-4">Neues Ergebnis hinzufügen</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label htmlFor="player1_score" className="block text-sm font-medium">
                                        {players.player1?.name}
                                    </label>
                                    <Input
                                        id="player1_score"
                                        type="number"
                                        min="0"
                                        value={newScore.player1_score}
                                        onChange={(e) => setNewScore({ ...newScore, player1_score: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="player2_score" className="block text-sm font-medium">
                                        {players.player2?.name}
                                    </label>
                                    <Input
                                        id="player2_score"
                                        type="number"
                                        min="0"
                                        value={newScore.player2_score}
                                        onChange={(e) => setNewScore({ ...newScore, player2_score: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="mt-4"
                                disabled={addingScore}
                            >
                                {addingScore ? 'Wird eingetragen...' : 'Ergebnis eintragen'}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
} 