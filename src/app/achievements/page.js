'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { supabase } from '@/lib/supabase-client';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import {
    TrophyIcon,
    FireIcon,
    BoltIcon,
    PlayIcon,
    UserGroupIcon,
    StarIcon,
    FlagIcon,
    SparklesIcon,
    RocketLaunchIcon,
    LockClosedIcon,
    ShieldExclamationIcon,
    ArrowPathIcon,
    ScissorsIcon,
    GlobeAltIcon,
    AcademicCapIcon
} from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

export default function AchievementsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [achievements, setAchievements] = useState([]);
    const [userAchievements, setUserAchievements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, achieved: 0 });
    const [error, setError] = useState(null);

    // Router-Schutz: Leite zur Login-Seite weiter, wenn der Benutzer nicht angemeldet ist
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Achievement-Definitionen als Konstante außerhalb der Komponente
    const allAchievements = useMemo(() => [
        {
            id: 'first_match',
            title: 'Erstes Match',
            description: 'Spiele dein erstes Match',
            icon: <FlagIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        },
        {
            id: 'first_win',
            title: 'Erster Sieg',
            description: 'Gewinne dein erstes Match',
            icon: <TrophyIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        },
        {
            id: 'streak_3',
            name: 'Siegesserie',
            icon: <FireIcon className="h-8 w-8" />,
            description: 'Gewinne 3 Spiele in Folge',
            threshold: 3,
            type: 'streak',
        },
        {
            id: 'streak_5',
            name: 'Unaufhaltsam',
            icon: <BoltIcon className="h-8 w-8" />,
            description: 'Gewinne 5 Spiele in Folge',
            threshold: 5,
            type: 'streak',
        },
        {
            id: 'streak_10',
            name: 'Dominator',
            icon: <RocketLaunchIcon className="h-8 w-8" />,
            description: 'Gewinne 10 Spiele in Folge',
            threshold: 10,
            type: 'streak',
        },
        {
            id: 'matches_10',
            name: 'Anfänger',
            icon: <PlayIcon className="h-8 w-8" />,
            description: 'Spiele 10 Spiele',
            threshold: 10,
            type: 'games',
        },
        {
            id: 'matches_25',
            name: 'Enthusiast',
            icon: <UserGroupIcon className="h-8 w-8" />,
            description: 'Spiele 25 Spiele',
            threshold: 25,
            type: 'games',
        },
        {
            id: 'matches_50',
            name: 'CourtSide-Veteran',
            icon: <AcademicCapIcon className="h-8 w-8" />,
            description: 'Spiele 50 Spiele',
            threshold: 50,
            type: 'games',
        },
        {
            id: 'daily_winner',
            title: 'Tagessieg',
            description: 'Sei der beste Spieler des Tages',
            icon: <SparklesIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        },
        {
            id: 'underdog',
            title: 'Underdog',
            description: 'Besiege einen höher platzierten Spieler',
            icon: <ShieldExclamationIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        },
        {
            id: 'perfect_match',
            title: 'Perfektes Spiel',
            description: 'Gewinne ein Match ohne einen einzigen Punkt zu verlieren',
            icon: <StarIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        },
        {
            id: 'comeback_king',
            title: 'Comeback-König',
            description: 'Gewinne ein Spiel nach 0:2 Satzrückstand',
            icon: <ArrowPathIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        },
        {
            id: 'win_streak_breaker',
            title: 'Serienkiller',
            description: 'Beende die Siegesserie eines Spielers mit mindestens 5 Siegen in Folge',
            icon: <ScissorsIcon className="h-8 w-8" />,
            backgroundColor: 'bg-secondary',
            textColor: 'text-primary'
        }
    ], []);

    // Lade Achievements für den aktuellen Benutzer oder zeige alle Achievements an
    useEffect(() => {
        let isMounted = true;
        let retryTimeout;

        const fetchAchievements = async () => {
            if (!user) return;

            try {
                setLoading(true);
                setError(null);

                if (user) {
                    // Optimierte Abfrage mit spezifischer Feldauswahl
                    const { data, error } = await supabase
                        .from('player_achievements')
                        .select('achievement_id, achieved_at')
                        .eq('player_id', user.id)
                        .throwOnError();

                    if (error) {
                        throw error;
                    }

                    if (isMounted) {
                        setUserAchievements(data || []);

                        // Kombiniere alle Achievements mit Benutzerstatus
                        const achievementsWithStatus = allAchievements.map(achievement => {
                            const userAchievement = data?.find(ua => ua.achievement_id === achievement.id);
                            return {
                                ...achievement,
                                achieved: !!userAchievement,
                                achievedAt: userAchievement?.achieved_at
                            };
                        });

                        setAchievements(achievementsWithStatus);

                        // Statistiken berechnen
                        const achievedCount = achievementsWithStatus.filter(a => a.achieved).length;
                        setStats({
                            total: allAchievements.length,
                            achieved: achievedCount
                        });
                    }
                } else {
                    // Wenn kein Benutzer angemeldet ist, zeige alle Achievements als nicht erreicht an
                    const achievementsWithoutStatus = allAchievements.map(achievement => ({
                        ...achievement,
                        achieved: false
                    }));

                    if (isMounted) {
                        setAchievements(achievementsWithoutStatus);
                        setStats({
                            total: allAchievements.length,
                            achieved: 0
                        });
                    }
                }
            } catch (error) {
                console.error('Fehler beim Laden der Achievements:', error);
                if (isMounted) {
                    setError('Fehler beim Laden der Achievements');
                    toast.error('Fehler beim Laden der Achievements');

                    // Wiederholungsversuch mit exponentieller Verzögerung
                    let retryCount = 0;
                    const maxRetries = 3;
                    const retryWithBackoff = async () => {
                        if (retryCount >= maxRetries || !isMounted) return;

                        retryCount++;
                        const delay = 1000 * Math.pow(2, retryCount - 1);

                        await new Promise(resolve => setTimeout(resolve, delay));

                        try {
                            const { data: retryData, error: retryError } = await supabase
                                .from('player_achievements')
                                .select('achievement_id, achieved_at')
                                .eq('player_id', user.id)
                                .throwOnError();

                            if (retryError) {
                                throw retryError;
                            }

                            if (isMounted) {
                                setUserAchievements(retryData || []);
                                const achievementsWithStatus = allAchievements.map(achievement => {
                                    const userAchievement = retryData?.find(ua => ua.achievement_id === achievement.id);
                                    return {
                                        ...achievement,
                                        achieved: !!userAchievement,
                                        achievedAt: userAchievement?.achieved_at
                                    };
                                });

                                setAchievements(achievementsWithStatus);
                                setStats({
                                    total: allAchievements.length,
                                    achieved: achievementsWithStatus.filter(a => a.achieved).length
                                });
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
                        retryTimeout = setTimeout(() => {
                            router.refresh();
                        }, 5000);
                    }
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        if (user && !authLoading) {
            fetchAchievements();
        }

        return () => {
            isMounted = false;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
            }
        };
    }, [user, authLoading, router, allAchievements]);

    // Fortschrittberechnung
    const progressPercentage = useMemo(() =>
        stats.total > 0 ? (stats.achieved / stats.total) * 100 : 0,
        [stats.total, stats.achieved]
    );

    if (authLoading) {
        return <div className="text-center py-8">Authentifizierung lädt...</div>;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold mb-2">Achievements</h1>
                <p className="text-zinc-400 mb-4">
                    Sammle Auszeichnungen für deine Leistungen und Erfolge. Achievements werden automatisch freigeschaltet, wenn du bestimmte Ziele erreichst.
                </p>

                {user && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">Fortschritt: {stats.achieved} von {stats.total} freigeschaltet</span>
                            <span className="text-sm font-medium">{Math.round(progressPercentage)}%</span>
                        </div>
                        <div className="w-full bg-zinc-700 rounded-full h-2.5">
                            <div
                                className="bg-primary h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="text-center py-12">Lade Achievements...</div>
            ) : error ? (
                <div className="text-center py-12 text-red-600">{error}</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {achievements.map((achievement) => (
                        <Card
                            key={achievement.id}
                            className={`overflow-hidden border-2 transition-all duration-300 ${achievement.achieved
                                ? 'border-primary ' + achievement.backgroundColor
                                : 'border-zinc-700 bg-zinc-900 opacity-75'
                                }`}
                        >
                            <CardHeader className="pb-3 relative">
                                <div className="flex items-center justify-between mb-2">
                                    <div className={`p-2.5 rounded-full ${achievement.achieved
                                        ? 'bg-secondary text-primary'
                                        : 'bg-zinc-800 text-zinc-400'
                                        }`}
                                    >
                                        {achievement.icon}
                                    </div>
                                    {achievement.achieved ? (
                                        <div className="rounded-full p-1">
                                            <CheckCircleIcon className="h-6 w-6 text-primary" />
                                        </div>
                                    ) : (
                                        <LockClosedIcon className="h-5 w-5 text-zinc-500" />
                                    )}
                                </div>
                                <CardTitle className={achievement.achieved ? 'text-primary' : 'text-zinc-400'}>
                                    {achievement.title || achievement.name}
                                </CardTitle>
                                <CardDescription className={achievement.achieved ? 'text-zinc-300' : 'text-zinc-500'}>
                                    {achievement.description}
                                </CardDescription>
                            </CardHeader>
                            {achievement.threshold && (
                                <CardContent className="pt-0 pb-3">
                                    <div className="w-full bg-zinc-700 rounded-full h-1.5 mt-1">
                                        <div
                                            className={`${achievement.achieved ? 'bg-primary' : 'bg-secondary'} h-1.5 rounded-full`}
                                            style={{ width: achievement.achieved ? '100%' : '0%' }}
                                        ></div>
                                    </div>
                                </CardContent>
                            )}
                            {achievement.achieved && (
                                <CardFooter className="pt-0 pb-4">
                                    <p className="text-xs text-zinc-400">
                                        Freigeschaltet am {new Date(achievement.achievedAt).toLocaleDateString('de-DE')}
                                    </p>
                                </CardFooter>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Wie funktionieren Achievements?</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-zinc-400">
                        Achievements werden automatisch freigeschaltet, wenn du bestimmte Ziele erreichst.
                        Einige Achievements basieren auf deiner Spielanzahl, andere auf Siegesserien oder besonderen Leistungen.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
} 