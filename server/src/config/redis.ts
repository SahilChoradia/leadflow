import Redis from 'ioredis';

// Singleton — shared across the server process
let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) throw new Error('Redis not yet connected — call connectRedis() first');
  return redisClient;
}

export async function connectRedis(): Promise<Redis> {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';

  redisClient = new Redis(url, {
    maxRetriesPerRequest: null, // Required for BullMQ blocking commands
    enableReadyCheck: true,
    lazyConnect: true,
  });

  redisClient.on('connect', () => console.info('[redis] Connected'));
  redisClient.on('error', (err) => console.error('[redis] Error:', err));

  await redisClient.connect();
  return redisClient;
}
