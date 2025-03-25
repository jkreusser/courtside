'use client';

import { useEffect, useState } from 'react';
import { getRankings } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { eventBus, EVENTS } from '@/lib/eventBus';

export default function RankingsList() {
    const [rankings, setRankings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { connectionState } = useAuth();

    const loadRankings = async () => {
        try {
            setLoading(true);
            const { data, error } = await getRankings();
            if (error) throw error;
            setRankings(data || []);
        } catch (error) {
            console.error('Fehler beim Laden der Rangliste:', error);
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRankings();

        // Event-Listener für Visibility-Change
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && connectionState === 'connected') {
                loadRankings();
            }
        };

        // Event-Listener für Datenaktualisierung
        const handleDataRefresh = () => {
            if (connectionState === 'connected') {
                loadRankings();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        eventBus.on(EVENTS.DATA_REFRESH, handleDataRefresh);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            eventBus.off(EVENTS.DATA_REFRESH, handleDataRefresh);
        };
    }, [connectionState]);

    if (loading) return <div>Lade Rangliste...</div>;
    if (error) return <div>Fehler beim Laden der Rangliste</div>;
    if (!rankings.length) return <div>Keine Rangliste verfügbar</div>;

    return (
        <div className="space-y-4">
            {rankings.map((ranking, index) => (
                <div key={ranking.id} className="flex items-center justify-between p-4 bg-zinc-900 rounded-lg">
                    <div className="flex items-center space-x-4">
                        <span className="text-lg font-bold">{index + 1}</span>
                        <span>{ranking.name}</span>
                    </div>
                    <span className="text-lg font-bold">{ranking.points}</span>
                </div>
            ))}
        </div>
    );
} 