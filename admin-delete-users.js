#!/usr/bin/env node

/**
 * Admin-Script für die vollständige Benutzer-Löschung
 * 
 * Dieses Script:
 * 1. Verarbeitet ausstehende Löschungsanfragen
 * 2. Löscht Auth-Users vollständig (gibt Email-Adressen frei)
 * 3. Läuft lokal mit Service Role Key aus .env.local
 * 
 * Verwendung: node admin-delete-users.js
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Supabase Admin Client mit Service Role Key
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // Aus .env.local - NIEMALS in Code committen!
);

async function processUserDeletions() {
    console.log('🚀 Admin-Script: Verarbeitung von Löschungsanfragen gestartet...\n');

    try {
        // 1. Ausstehende Löschungsanfragen abrufen
        console.log('📋 Schritt 1: Ausstehende Löschungsanfragen abrufen...');
        const { data: pendingRequests, error: fetchError } = await supabaseAdmin
            .from('deletion_requests')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true });

        if (fetchError) {
            console.error('❌ Fehler beim Abrufen der Anfragen:', fetchError);
            return;
        }

        if (!pendingRequests || pendingRequests.length === 0) {
            console.log('✅ Keine ausstehenden Löschungsanfragen gefunden.');
            return;
        }

        console.log(`📊 ${pendingRequests.length} ausstehende Löschungsanfrage(n) gefunden.\n`);

        // 2. Jede Anfrage verarbeiten
        for (const request of pendingRequests) {
            console.log(`🔄 Verarbeite Löschungsanfrage für User: ${request.user_id}`);
            console.log(`   Email: ${request.email}`);
            console.log(`   Erstellt: ${new Date(request.created_at).toLocaleString()}`);

            try {
                // 2a. Auth-User vollständig löschen (gibt Email frei)
                console.log('   🗑️  Auth-User löschen...');
                const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
                    request.user_id
                );

                if (deleteError) {
                    throw new Error(`Auth-User-Löschung fehlgeschlagen: ${deleteError.message}`);
                }

                // 2b. Löschungsanfrage als abgeschlossen markieren
                console.log('   ✅ Löschungsanfrage als abgeschlossen markieren...');
                const { error: updateError } = await supabaseAdmin
                    .from('deletion_requests')
                    .update({
                        status: 'completed',
                        processed_at: new Date().toISOString()
                    })
                    .eq('id', request.id);

                if (updateError) {
                    console.warn('   ⚠️  Warnung: Status-Update fehlgeschlagen:', updateError.message);
                }

                console.log(`   ✅ User ${request.user_id} erfolgreich gelöscht!\n`);

            } catch (error) {
                console.error(`   ❌ Fehler bei User ${request.user_id}:`, error.message);

                // Löschungsanfrage als fehlgeschlagen markieren
                try {
                    await supabaseAdmin
                        .from('deletion_requests')
                        .update({
                            status: 'failed',
                            processed_at: new Date().toISOString(),
                            error_message: error.message
                        })
                        .eq('id', request.id);
                } catch (updateError) {
                    console.error('   ❌ Fehler beim Status-Update:', updateError.message);
                }

                console.log(''); // Leerzeile für bessere Lesbarkeit
            }
        }

        console.log('🎉 Verarbeitung aller Löschungsanfragen abgeschlossen!');

    } catch (error) {
        console.error('❌ Kritischer Fehler im Admin-Script:', error);
    }
}

// Script ausführen
if (require.main === module) {
    processUserDeletions()
        .then(() => {
            console.log('\n✅ Admin-Script beendet.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Admin-Script mit Fehler beendet:', error);
            process.exit(1);
        });
}

module.exports = { processUserDeletions }; 