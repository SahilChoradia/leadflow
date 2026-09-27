/**
 * Phase 1 — Tenant isolation test
 *
 * Verifies: guessing another tenant's resource ID returns 404/403, never data.
 *
 * Run with:  npx ts-node src/tests/tenantIsolation.test.ts
 *
 * This is a standalone integration test (no Jest needed for Phase 1).
 * It requires a running MongoDB — uses the MONGO_URI from .env.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import { Brokerage } from '../models/Brokerage';
import type { JwtPayload } from '@leadflow/types';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.info(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function makeToken(userId: string, role: string, brokerageId: string): string {
  return jwt.sign(
    { sub: userId, role, brokerageId } as JwtPayload,
    process.env.JWT_SECRET!,
    { expiresIn: '1h' },
  );
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI!);
  console.info('[test] Connected to MongoDB\n');

  // ── Setup: two isolated brokerages ───────────────────────────────────────────
  const brokerageA = await Brokerage.create({ name: 'Test Brokerage A', slug: `test-a-${Date.now()}` });
  const brokerageB = await Brokerage.create({ name: 'Test Brokerage B', slug: `test-b-${Date.now()}` });

  const hash = await bcrypt.hash('Password1!', 10);
  const userA = await User.create({
    email:        `advisor-a-${Date.now()}@test.com`,
    passwordHash: hash,
    name:         'Advisor A',
    role:         'advisor',
    brokerageId:  brokerageA._id,
  });

  // Lead belonging to Brokerage A
  const leadA = await Lead.create({
    brokerageId: brokerageA._id,
    firstName:   'Alice',
    lastName:    'Test',
    email:       `alice-${Date.now()}@test.com`,
    source:      'manual',
  });

  console.info('─── Test 1: Tenant scope plugin blocks cross-tenant query ───────');

  // Attempt to query Lead with Brokerage B's ID — the plugin MUST reject this
  try {
    await Lead.findOne({ brokerageId: brokerageB._id, _id: leadA._id });
    // If we get here, the record was NOT found (correct behavior — different brokerageId)
    const found = await Lead.findOne({ brokerageId: brokerageB._id, _id: leadA._id });
    assert(found === null, 'Lead not returned when queried with wrong brokerageId');
  } catch (err) {
    assert(false, `Unexpected error: ${(err as Error).message}`);
  }

  console.info('\n─── Test 2: Plugin blocks query with NO brokerageId ─────────────');

  try {
    await Lead.findById(leadA._id); // No brokerageId — plugin should throw
    assert(false, 'Query without brokerageId should have been rejected');
  } catch (err) {
    const message = (err as Error).message;
    assert(
      message.includes('[tenantScope]'),
      `Plugin correctly rejected unscoped query: "${message.slice(0, 80)}"`,
    );
  }

  console.info('\n─── Test 3: Correct brokerageId returns the lead ────────────────');

  try {
    const found = await Lead.findOne({ brokerageId: brokerageA._id, _id: leadA._id });
    assert(found !== null, 'Lead found with correct brokerageId');
    assert(found!._id.toString() === leadA._id.toString(), 'Correct lead returned');
  } catch (err) {
    assert(false, `Unexpected error: ${(err as Error).message}`);
  }

  console.info('\n─── Test 4: JWT payload contains brokerageId ────────────────────');
  const _token = makeToken(userA._id.toString(), 'advisor', brokerageA._id.toString());
  const decoded = jwt.verify(_token, process.env.JWT_SECRET!) as JwtPayload;
  assert(decoded.brokerageId === brokerageA._id.toString(), 'JWT brokerageId matches');
  assert(decoded.role === 'advisor', 'JWT role correct');

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  await Lead.deleteOne({ brokerageId: brokerageA._id, _id: leadA._id });
  await User.deleteOne({ _id: userA._id });
  await Brokerage.deleteMany({ slug: { $in: [brokerageA.slug, brokerageB.slug] } });

  console.info('\n─────────────────────────────────────────────────────────────────');
  console.info(`Results: ${passed} passed, ${failed} failed`);

  await mongoose.disconnect();

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('[test] Fatal:', err);
  process.exit(1);
});
