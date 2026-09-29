import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { User } from '../models/User';
import { Brokerage } from '../models/Brokerage';
import { Client } from '../models/Client';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

async function createDemoUsers() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI is not set in .env');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(uri);
  console.log('Connected.');

  // Create Brokerage
  let brokerage = await Brokerage.findOne({ name: 'Demo Brokerage' });
  if (!brokerage) {
    brokerage = await Brokerage.create({
      name: 'Demo Brokerage',
      slug: 'demo-brokerage',
      domain: 'demo',
    });
    console.log('Created Brokerage: Demo Brokerage');
  } else {
    console.log('Brokerage already exists.');
  }

  const hashPassword = async (pass: string) => bcrypt.hash(pass, 10);

  // 1. Platform Admin
  let admin = await User.findOne({ email: 'admin@leadflow.app' });
  if (!admin) {
    admin = await User.create({
      email: 'admin@leadflow.app',
      passwordHash: await hashPassword('ChangeMe123!'),
      name: 'System Admin',
      role: 'platform_admin',
    });
    console.log('Created Admin: admin@leadflow.app / ChangeMe123!');
  } else {
    console.log('Admin already exists.');
  }

  // 2. Brokerage Admin
  let broker = await User.findOne({ email: 'broker@leadflow.app' });
  if (!broker) {
    broker = await User.create({
      email: 'broker@leadflow.app',
      passwordHash: await hashPassword('Broker123!'),
      name: 'Demo Broker',
      role: 'brokerage_admin',
      brokerageId: brokerage._id,
    });
    console.log('Created Broker: broker@leadflow.app / Broker123!');
  } else {
    console.log('Broker already exists.');
  }

  // 3. Advisor
  let advisor = await User.findOne({ email: 'advisor@leadflow.app' });
  if (!advisor) {
    advisor = await User.create({
      email: 'advisor@leadflow.app',
      passwordHash: await hashPassword('Advisor123!'),
      name: 'Demo Advisor',
      role: 'advisor',
      brokerageId: brokerage._id,
    });
    console.log('Created Advisor: advisor@leadflow.app / Advisor123!');
  } else {
    console.log('Advisor already exists.');
  }

  // 4. Client
  let clientUser = await User.findOne({ email: 'client@leadflow.app' });
  if (!clientUser) {
    clientUser = await User.create({
      email: 'client@leadflow.app',
      passwordHash: await hashPassword('Client123!'),
      name: 'John Doe',
      role: 'client',
      brokerageId: brokerage._id,
    });
    console.log('Created Client User: client@leadflow.app / Client123!');
  } else {
    console.log('Client User already exists.');
  }

  // Ensure Client Profile Exists
  let clientProfile = await Client.findOne({ email: 'client@leadflow.app' });
  if (!clientProfile) {
    await Client.create({
      brokerageId: brokerage._id,
      userId: clientUser._id,
      email: 'client@leadflow.app',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+15551234567',
      assignedAdvisorId: advisor._id,
    });
    console.log('Created Client Profile.');
  }

  console.log('Done! Closing connection...');
  await mongoose.disconnect();
}

createDemoUsers().catch(console.error);
