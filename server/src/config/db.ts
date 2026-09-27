import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is not set');

  mongoose.connection.on('connected', () => console.info('[db] MongoDB connected'));
  mongoose.connection.on('disconnected', () => console.warn('[db] MongoDB disconnected'));
  mongoose.connection.on('error', (err) => console.error('[db] MongoDB error:', err));

  await mongoose.connect(uri, {
    // Recommended settings for Atlas / Mongoose 8
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 45_000,
  });
}
