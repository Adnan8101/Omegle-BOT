#!/usr/bin/env node
const { Client } = require('pg');
require('dotenv').config();

async function killConnections() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
        console.error('❌ DATABASE_URL not found in .env');
        process.exit(1);
    }

    const client = new Client({ 
        connectionString,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Get all connections except this one
        const result = await client.query(`
            SELECT pid, application_name, state, state_change
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid != pg_backend_pid()
              AND usename = current_user
        `);

        console.log(`\n🔍 Found ${result.rows.length} connection(s) to terminate`);

        if (result.rows.length === 0) {
            console.log('✅ No connections to kill');
            return;
        }

        // Show connections
        result.rows.forEach((row, i) => {
            console.log(`   ${i + 1}. PID: ${row.pid}, App: ${row.application_name || 'unknown'}, State: ${row.state}`);
        });

        // Kill connections
        for (const row of result.rows) {
            try {
                await client.query(`SELECT pg_terminate_backend($1)`, [row.pid]);
                console.log(`✅ Terminated connection PID ${row.pid}`);
            } catch (err) {
                console.log(`⚠️  Failed to terminate PID ${row.pid}: ${err.message}`);
            }
        }

        console.log('\n✅ Done! Connections have been terminated.');
        console.log('💡 Wait 5-10 seconds before starting your bot.');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

killConnections();
