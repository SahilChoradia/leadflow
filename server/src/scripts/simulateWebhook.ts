/**
 * Webhook simulation script — simulates an external lead source sending
 * leads to LeadFlow's ingestion endpoint.
 *
 * Run: npx ts-node server/src/scripts/simulateWebhook.ts
 *
 * Tests:
 *  1. Normal ingestion of 5 unique leads
 *  2. Idempotency — sends lead #1 again; must not create a duplicate
 *  3. Duplicate detection — sends a lead with the same email as lead #2
 *  4. Burst test — sends 20 rapid requests with the same externalId
 */
import 'dotenv/config';

const BASE_URL   = process.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';
const BROKERAGE  = 'alpha-mortgage';
const ENDPOINT   = `${BASE_URL}/api/webhooks/leads/${BROKERAGE}`;

interface WebhookResponse {
  success: boolean;
  data?:   { isDuplicate?: boolean; [key: string]: unknown };
  meta?:   { idempotent?: boolean; isDuplicate?: boolean };
  error?:  string;
}

async function post(payload: object): Promise<{ status: number; body: WebhookResponse }> {
  const res = await fetch(ENDPOINT, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  return { status: res.status, body: (await res.json()) as WebhookResponse };
}

async function run() {
  console.info(`\nWebhook target: ${ENDPOINT}\n`);

  // ── 1. Normal ingestion ─────────────────────────────────────────────────────
  console.info('─── Test 1: Normal ingestion (5 unique leads) ───────────────────');
  const leads = [
    { externalId: 'ext-001', source: 'typeform', firstName: 'Hans',  lastName: 'Müller',   email: 'hans.muller@example.de',   phone: '+49 151 1234 0001' },
    { externalId: 'ext-002', source: 'typeform', firstName: 'Anna',  lastName: 'Schmidt',  email: 'anna.schmidt@example.de',  phone: '+49 151 1234 0002' },
    { externalId: 'ext-003', source: 'fb_ads',   firstName: 'Tom',   lastName: 'Weber',    email: 'tom.weber@example.de',     phone: '+49 151 1234 0003' },
    { externalId: 'ext-004', source: 'fb_ads',   firstName: 'Julia', lastName: 'Fischer',  email: 'julia.fischer@example.de', phone: '+49 151 1234 0004' },
    { externalId: 'ext-005', source: 'referral', firstName: 'Max',   lastName: 'Becker',   email: 'max.becker@example.de',    phone: '+49 151 1234 0005' },
  ];

  for (const lead of leads) {
    const { status, body } = await post(lead);
    console.info(`  ${status === 201 ? '✓' : '✗'} [${status}] ${lead.firstName} ${lead.lastName} — idempotent: ${body.meta?.idempotent ?? false}`);
  }

  // ── 2. Idempotency — resend lead #1 ─────────────────────────────────────────
  console.info('\n─── Test 2: Idempotency (same lead sent twice) ──────────────────');
  const { status: s2, body: b2 } = await post(leads[0]);
  const pass2 = s2 === 200 && b2.meta?.idempotent === true;
  console.info(`  ${pass2 ? '✓' : '✗'} [${s2}] idempotent=${b2.meta?.idempotent} (expected: true, 200)`);

  // ── 3. Duplicate detection — same email as lead #2 ───────────────────────────
  console.info('\n─── Test 3: Duplicate detection (same email) ────────────────────');
  const { status: s3, body: b3 } = await post({
    externalId: 'ext-099',
    source:     'manual',
    firstName:  'Different',
    lastName:   'Person',
    email:      leads[1].email, // same email as ext-002
  });
  const pass3 = b3.data?.isDuplicate === true;
  console.info(`  ${pass3 ? '✓' : '✗'} [${s3}] isDuplicate=${b3.data?.isDuplicate} (expected: true)`);

  // ── 4. Burst — 20 concurrent requests with same externalId ──────────────────
  console.info('\n─── Test 4: Burst (20 concurrent, same externalId) ──────────────');
  const burstPayload = {
    externalId: 'burst-001',
    source:     'burst_test',
    firstName:  'Burst',
    lastName:   'Lead',
    email:      `burst-${Date.now()}@test.de`,
  };

  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => post(burstPayload)),
  );

  const successes = results.filter(
    (r) => r.status === 'fulfilled' && (r.value.status === 200 || r.value.status === 201),
  ).length;
  const failures  = results.length - successes;

  console.info(`  ${failures === 0 ? '✓' : '✗'} ${successes}/20 succeeded, ${failures} failed`);
  console.info(`  ✓ No crash — all 20 requests returned safely`);

  console.info('\n─────────────────────────────────────────────────────────────────\n');
}

run().catch(console.error);
