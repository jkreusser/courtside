import { useEffect, useState } from 'react';
import { getGames } from '@/lib/supabase-client';
import { useDataRefresh } from '@/lib/hooks/useDataRefresh';

export default function GamesList() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadGames = async () => {
        try {
            setLoading(true);
            const { data, error } = await getGames();
            if (error) throw error;
            setGames(data);
        } catch (error) {
            console.error('Fehler beim Laden der Spiele:', error);
            setError(error);
        } finally {
            setLoading(false);
        }
    };

    // Initiales Laden
    useEffect(() => {
        loadGames();
    }, []);

    // Automatische Aktualisierung
    useDataRefresh([loadGames]);

    if (loading) return <div>Lade Spiele...</div>;
    if (error) return <div>Fehler beim Laden der Spiele</div>;

    return (
        <div>
            {games.map(game => (
                <div key={game.id}>
                    {/* Spiel-Details */}
                </div>
            ))}
        </div>
    );
} 