import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    JWT_SECRET: z.string().min(8), // Relaxed for dev, though production should use 32+
    JWT_EXPIRES_IN: z.string().default('8h'),
    PORT: z.string().default('3000'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});
const env = envSchema.safeParse(process.env);
if (!env.success) {
    console.error('❌ Invalid environment variables:', env.error.format());
    process.exit(1);
}
export const ENV = env.data;
