import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load env files
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const localUri = 'mongodb://localhost:27017/leadflow';
const remoteUri = process.env.MONGO_URI;

if (!remoteUri) {
  console.error('Remote MONGO_URI not found in .env');
  process.exit(1);
}

async function migrate() {
  console.log('Connecting to local DB...');
  const localConn = await mongoose.createConnection(localUri).asPromise();
  console.log('Connected to local DB.');

  console.log('Connecting to remote DB...');
  const remoteConn = await mongoose.createConnection(remoteUri as string).asPromise();
  console.log('Connected to remote DB.');

  try {
    const collections = await localConn.db!.listCollections().toArray();
    
    for (const colInfo of collections) {
      if (colInfo.name === 'system.profile') continue;
      
      console.log(`\nMigrating collection: ${colInfo.name}`);
      const localCol = localConn.db!.collection(colInfo.name);
      const remoteCol = remoteConn.db!.collection(colInfo.name);
      
      const docs = await localCol.find({}).toArray();
      console.log(`Found ${docs.length} documents in local DB.`);
      
      if (docs.length > 0) {
        console.log('Clearing remote collection...');
        await remoteCol.deleteMany({});
        
        console.log('Inserting into remote collection...');
        await remoteCol.insertMany(docs);
        console.log(`Successfully migrated ${docs.length} documents to ${colInfo.name}.`);
      } else {
        console.log(`Skipping empty collection: ${colInfo.name}`);
      }
    }
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await localConn.close();
    await remoteConn.close();
  }
}

migrate().catch(console.error);
