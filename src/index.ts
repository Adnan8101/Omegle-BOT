import { login } from './core/discord';
import { events } from './core/events';
import { stopGiveawaySystem } from './services/GiveawayIntegration';

async function main() {
    try {
        events.init();
        await login();

        // Graceful Shutdown
        const shutdown = async () => {
            console.log('Shutting down...');
            try {
                stopGiveawaySystem();
                const { db } = require('./data/db');
                await db.$disconnect();
                console.log('Database disconnected.');
            } catch (e) {
                console.error(e);
            }
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
