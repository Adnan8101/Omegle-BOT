import { login } from './core/discord';
import { events } from './core/events';
import { stopGiveawaySystem } from './services/GiveawayIntegration';

async function main() {
    console.log('🚀 Starting Discord Bot...');
    console.log(`📅 Current time: ${new Date().toISOString()}`);
    console.log(`🔧 Node.js version: ${process.version}`);
    console.log(`📦 Working directory: ${process.cwd()}`);
    
    try {
        console.log('⚙️  Initializing events system...');
        events.init();
        console.log('✅ Events system initialized');
        
        console.log('🔑 Logging in to Discord...');
        await login();
        console.log('✅ Successfully logged in to Discord');

        // Graceful Shutdown
        const shutdown = async () => {
            console.log('🛑 Database disconnecting...');
            console.log('Shutting down...');
            try {
                stopGiveawaySystem();
                const { db } = require('./data/db');
                await db.$disconnect();
                console.log('✅ Database disconnected');
                console.log('Database disconnected.');
            } catch (e) {
                console.error('❌ Error during shutdown:', e);
            }
            console.log('👋 Process exiting');
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (err) {
        console.error('💥 Fatal error during startup:', err);
        process.exit(1);
    }
}

main();
