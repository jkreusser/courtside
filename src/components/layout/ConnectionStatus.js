'use client';

import { useAuth } from '@/lib/auth-context';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ConnectionStatus() {
    const { connectionState, isOnline, needsRefresh, refreshData } = useAuth();
    const [showOffline, setShowOffline] = useState(false);

    useEffect(() => {
        let timeoutId;

        if (!isOnline) {
            timeoutId = setTimeout(() => {
                setShowOffline(true);
                toast.error('Keine Verbindung zum Server', {
                    id: 'connection-lost',
                    duration: Infinity
                });
            }, 2000);
        } else {
            setShowOffline(false);
            toast.dismiss('connection-lost');
            if (needsRefresh) {
                refreshData();
            }
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isOnline, needsRefresh, refreshData]);

    if (!showOffline) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-red-500 text-white p-4 text-center z-50">
            <p className="text-sm">
                Keine Verbindung zum Server. Versuche wiederherzustellen...
            </p>
        </div>
    );
} 