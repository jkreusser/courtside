'use client';

import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
    return (
        <Toaster
            position="top-right"
            toastOptions={{
                duration: 3000,
                style: {
                    background: '#18181b', // zinc-900
                    color: '#ededed', // foreground
                    border: '1px solid #27272a', // zinc-800
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    fontSize: '14px',
                    padding: '12px 16px',
                },
                success: {
                    duration: 3000,
                    style: {
                        background: '#0d2a18', // secondary
                        color: '#7bf1a8', // primary
                        border: '1px solid #7bf1a8', // primary
                    },
                    iconTheme: {
                        primary: '#7bf1a8', // primary
                        secondary: '#0d2a18', // secondary
                    }
                },
                error: {
                    duration: 4000,
                    style: {
                        background: '#18181b', // zinc-900
                        color: '#ef4444', // red-500
                        border: '1px solid #dc2626', // red-600
                    },
                    iconTheme: {
                        primary: '#ef4444', // red-500
                        secondary: '#18181b', // zinc-900
                    }
                },
            }}
        />
    );
} 