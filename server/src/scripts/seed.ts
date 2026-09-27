/**
 * Seed script — creates the platform_admin account and an optional demo brokerage.
 * Run once: npm run seed --workspace=server
 *
 * Safe to run multiple times — uses upsert logic, won't create duplicates.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Brokerage } from '../models/Brokerage';
import { DashboardCache } from '../models/DashboardCache';

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');

  await mongoose.connect(uri);
  console.info('[seed] Connected to MongoDB');

  // ── 1. Platform admin ────────────────────────────────────────────────────────
  const adminEmail = process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@leadflow.app';
  const adminPass  = process.env.PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';

  const existingAdmin = await User.findOne({ email: adminEmail });
  if (existingAdmin) {
    console.info(`[seed] Platform admin already exists: ${adminEmail}`);
  } else {
    const passwordHash = await bcrypt.hash(adminPass, 12);
    await User.create({
      email: adminEmail,
      passwordHash,
      name: 'Platform Admin',
      role: 'platform_admin',
    });
    console.info(`[seed] ✓ Platform admin created: ${adminEmail}`);
  }

  // ── 2. Demo brokerage + brokerage_admin (for dev convenience) ────────────────
  const demoSlug = 'alpha-mortgage';
  let demoBrokerage = await Brokerage.findOne({ slug: demoSlug });

  if (!demoBrokerage) {
    demoBrokerage = await Brokerage.create({ name: 'Alpha Mortgage GmbH', slug: demoSlug });
    await DashboardCache.create({ brokerageId: demoBrokerage._id });
    console.info(`[seed] ✓ Demo brokerage created: ${demoSlug}`);
  } else {
    console.info(`[seed] Demo brokerage already exists: ${demoSlug}`);
  }

  // ── 3. Demo brokerage admin ───────────────────────────────────────────────────
  const brokerageAdminEmail = 'admin@alpha-mortgage.demo';
  const existingBrokerageAdmin = await User.findOne({ email: brokerageAdminEmail });
  if (!existingBrokerageAdmin) {
    const passwordHash = await bcrypt.hash('Demo1234!', 12);
    await User.create({
      email: brokerageAdminEmail,
      passwordHash,
      name: 'Alpha Admin',
      role: 'brokerage_admin',
      brokerageId: demoBrokerage._id,
    });
    console.info(`[seed] ✓ Demo brokerage_admin created: ${brokerageAdminEmail}`);
  } else {
    console.info(`[seed] Demo brokerage_admin already exists: ${brokerageAdminEmail}`);
  }

  // ── 4. Demo advisor ───────────────────────────────────────────────────────────
  const advisorEmail = 'advisor@alpha-mortgage.demo';
  const existingAdvisor = await User.findOne({ email: advisorEmail });
  if (!existingAdvisor) {
    const passwordHash = await bcrypt.hash('Demo1234!', 12);
    await User.create({
      email: advisorEmail,
      passwordHash,
      name: 'Max Müller',
      role: 'advisor',
      brokerageId: demoBrokerage._id,
    });
    console.info(`[seed] ✓ Demo advisor created: ${advisorEmail}`);
  } else {
    console.info(`[seed] Demo advisor already exists: ${advisorEmail}`);
  }

  console.info('\n[seed] ─── Seed accounts ───────────────────────────────────────');
  console.info(`  Platform admin:    ${adminEmail}          / ${adminPass}`);
  console.info(`  Brokerage admin:   ${brokerageAdminEmail} / Demo1234!`);
  console.info(`  Advisor:           ${advisorEmail}        / Demo1234!`);
  console.info('[seed] ────────────────────────────────────────────────────────\n');

  // ── 5. Demo Automation & Email Template ───────────────────────────────────────
  const { EmailTemplate } = await import('../models/EmailTemplate');
  const { PipelineStageConfig } = await import('../models/PipelineStageConfig');

  let demoTemplate = await EmailTemplate.findOne({ brokerageId: demoBrokerage._id, name: 'Welcome Lead' });
  if (!demoTemplate) {
    demoTemplate = await EmailTemplate.create({
      brokerageId: demoBrokerage._id,
      name: 'Welcome Lead',
      subject: 'Welcome to Alpha Mortgage, {{firstName}}!',
      bodyHtml: '<p>Hi {{firstName}},</p><p>Thank you for reaching out. An advisor will contact you shortly.</p>',
      placeholders: ['firstName'],
    });
    console.info(`[seed] ✓ Demo email template created`);
  }

  const demoStageConfig = await PipelineStageConfig.findOne({ brokerageId: demoBrokerage._id, stage: 'contacted' });
  if (!demoStageConfig) {
    await PipelineStageConfig.create({
      brokerageId: demoBrokerage._id,
      stage: 'contacted',
      emailTemplateId: demoTemplate._id,
      tasks: [
        { title: 'Follow up after first contact', assigneePlaceholder: 'assigned_advisor', dueDaysOffset: 2 }
      ]
    });
    console.info(`[seed] ✓ Demo automation config created for 'contacted' stage`);
  }

  // ── 6. Demo Sample Leads ─────────────────────────────────────────────────────
  const { Lead } = await import('../models/Lead');
  const { Task } = await import('../models/Task');

  const leadCount = await Lead.countDocuments({ brokerageId: demoBrokerage._id });
  if (leadCount === 0) {
    const advisor = await User.findOne({ email: advisorEmail });
    const lead1 = await Lead.create({
      brokerageId: demoBrokerage._id,
      firstName: 'Elena',
      lastName: 'Rostova',
      email: 'elena.rostova@example.com',
      phone: '+49 170 1234567',
      stage: 'new',
      source: 'website',
      notes: 'Interested in Berlin apartment financing — 20% down payment ready.',
      version: 0,
    });

    const lead2 = await Lead.create({
      brokerageId: demoBrokerage._id,
      firstName: 'Liam',
      lastName: "O'Connor",
      email: 'liam.oc@example.com',
      phone: '+49 171 9876543',
      stage: 'contacted',
      source: 'referral',
      assignedAdvisorId: advisor?._id,
      notes: 'EU Blue Card holder, tech consultant looking in Munich.',
      version: 0,
    });

    const lead3 = await Lead.create({
      brokerageId: demoBrokerage._id,
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'priya.sharma@example.com',
      phone: '+49 172 5551234',
      stage: 'qualified',
      source: 'partner',
      assignedAdvisorId: advisor?._id,
      notes: 'Pre-approval docs ready for review.',
      version: 0,
    });

    if (advisor) {
      await Task.create({
        brokerageId: demoBrokerage._id,
        title: 'Review mortgage options with Liam',
        assignedAdvisorId: advisor._id,
        leadId: lead2._id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
    }

    console.info(`[seed] ✓ Seeded 3 sample leads + 1 initial task`);
  }

  await mongoose.disconnect();
  console.info('[seed] Done.');
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
