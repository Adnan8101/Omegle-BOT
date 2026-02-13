#!/usr/bin/env node
const { Client } = require('pg');
require('dotenv').config();

async function checkConnections() {
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

        // Check current connections
        const result = await client.query(`
            SELECT 
                count(*) as total_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') - count(*) as available_connections,
                (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_conn
            FROM pg_stat_activity
        `);

        const { total_connections, available_connections, max_conn } = result.rows[0];
        
        console.log('\n📊 Database Connection Status:');
        console.log(`   Total Connections: ${total_connections}/${max_conn}`);
        console.log(`   Available: ${available_connections}`);

        // Get connections by application
        const appResult = await client.query(`
            SELECT 
                application_name,
                count(*) as connections,
                state
            FROM pg_stat_activity
            WHERE datname = current_database()
            GROUP BY application_name, state
            ORDER BY connections DESC
        `);

        console.log('\n📱 Connections by Application:');
        appResult.rows.forEach(row => {
            console.log(`   ${row.application_name || 'unknown'}: ${row.connections} (${row.state})`);
        });

        if (available_connections < 5) {
            console.log('\n⚠️  WARNING: Very few connections available!');
            console.log('   Consider stopping other bot instances or increasing max_connections');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

checkConnections();
