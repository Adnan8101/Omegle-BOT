import { PrismaClient } from '@prisma/client';

const getDatabaseUrl = () => {
    const url = process.env.DATABASE_URL;
    if (!url) return url;

    // Check if connection_limit is already set
    if (url.includes('connection_limit')) return url;

    // Use minimal connection pool - only 1 connection
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_limit=1&pool_timeout=20&connect_timeout=20`;
};

// Singleton pattern to prevent multiple Prisma instances
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

// Force disconnect any existing connections
if (globalForPrisma.prisma) {
    console.log('⚠️  Disconnecting existing Prisma client...');
    globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
}

export const db = new PrismaClient({
    datasourceUrl: getDatabaseUrl(),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = db;
}

// Connection with retry logic
let connectionAttempts = 0;
const maxRetries = 5;

async function connectWithRetry(): Promise<void> {
    try {
        await db.$connect();
        console.log('✅ Database connected successfully');
        console.log(`📊 Connection pool: 1 connection (minimal usage mode)`);
    } catch (error: any) {
        connectionAttempts++;
        console.error(`❌ Failed to connect (attempt ${connectionAttempts}/${maxRetries}):`, error.message);
        
        if (connectionAttempts < maxRetries) {
            const waitTime = connectionAttempts * 2;
            console.log(`⏳ Retrying in ${waitTime} seconds...`);
            await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
            return connectWithRetry();
        } else {
            console.error('\n❌ Max retries reached. Possible issues:');
            console.error('   1. Database overloaded (run: npm run db:check)');
            console.error('   2. Production bot using all connections');
            console.error('   3. Network issues\n');
            process.exit(1);
        }
    }
}

// Connect on startup
connectWithRetry();

// Graceful shutdown handlers
const cleanup = async () => {
    console.log('🛑 Database disconnecting...');
    try {
        await db.$disconnect();
        console.log('✅ Database disconnected');
    } catch (error) {
        console.error('❌ Error during disconnect:', error);
    }
};

process.on('beforeExit', cleanup);
process.on('SIGINT', async () => {
    await cleanup();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await cleanup();
    process.exit(0);
});
process.on('exit', () => {
    console.log('👋 Process exiting');
});
