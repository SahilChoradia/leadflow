import 'dotenv/config';
import * as http from 'http';
import { app } from './app';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { initSocketIO } from './config/socket';
import { initWorkerEventSubscriber } from './queues/document.queue';

const PORT = parseInt(process.env.PORT ?? '4000', 10);

async function bootstrap() {
  // 1. Connect to infrastructure before accepting requests
  await connectDB();
  await connectRedis();

  // 2. Wrap Express in an HTTP server so Socket.io can share the port
  const httpServer = http.createServer(app);
  initSocketIO(httpServer);
  initWorkerEventSubscriber();

  httpServer.listen(PORT, () => {
    console.info(`[server] LeadFlow API listening on port ${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
