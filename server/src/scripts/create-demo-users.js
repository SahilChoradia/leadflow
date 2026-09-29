const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const uri = 'mongodb+srv://leadflow79_db_user:leadflow@cluster0.zcrfc0h.mongodb.net/?appName=Cluster0';

async function createDemoUsers() {
  console.log('Connecting to database...');
  await mongoose.connect(uri);
  console.log('Connected.');

  // Minimal Schemas
  const brokerageSchema = new mongoose.Schema({
    name: String,
    slug: String,
    domain: String,
  }, { strict: false });
  const Brokerage = mongoose.models.Brokerage || mongoose.model('Brokerage', brokerageSchema);

  const userSchema = new mongoose.Schema({
    email: String,
    passwordHash: String,
    name: String,
    role: String,
    brokerageId: mongoose.Schema.Types.ObjectId,
  }, { strict: false });
  const User = mongoose.models.User || mongoose.model('User', userSchema);

  const clientSchema = new mongoose.Schema({
    email: String,
    firstName: String,
    lastName: String,
    phone: String,
    brokerageId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    assignedAdvisorId: mongoose.Schema.Types.ObjectId,
  }, { strict: false });
  const Client = mongoose.models.Client || mongoose.model('Client', clientSchema);

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

  const hashPassword = async (pass) => bcrypt.hash(pass, 10);

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

  console.log('Done!');
  await mongoose.disconnect();
}

createDemoUsers().catch(console.error);
