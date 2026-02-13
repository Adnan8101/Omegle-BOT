import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    DISCORD_TOKEN: z.string().min(1),
    DATABASE_URL: z.string().min(1), // format: postgres://user:pass@host:port/db
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    CLIENT_ID: z.string(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
    console.error('<:cross:1469273232929456314> Invalid environment variables:', JSON.stringify(parsed.error.format(), null, 4));
    process.exit(1);
}

export const config = parsed.data;
