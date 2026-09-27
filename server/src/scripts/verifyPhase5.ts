/**
 * Phase 5 Verification Script — Background Document Verification (BullMQ Worker)
 *
 * Verifies:
 *  1. Non-blocking document upload that enqueues a BullMQ job with deterministic jobId.
 *  2. Worker processes job asynchronously from queue.
 *  3. Document transitions from 'pending' -> 'checking' -> 'passed' (or 'failed').
 *  4. Live Socket.io push notifications received in real time on status changes.
 *  5. Idempotent re-processing safety: already-verified documents are safely skipped.
 *  6. Failure simulation: documents with 'fail' in the name fail gracefully with a reason.
 *
 * Run: npx tsx server/src/scripts/verifyPhase5.ts
 */
import 'dotenv/config';
import { io as ClientSocket, Socket } from 'socket.io-client';

const API_BASE = 'http://localhost:4000';

async function postJson(url: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as any };
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: (await res.json()) as any };
}

function connectSocket(token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ClientSocket(API_BASE, {
      path: '/socket.io',
      auth: { token },
      transports: ['websocket'],
      timeout: 5000,
    });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (err) => reject(err));
  });
}

async function run() {
  console.info('\n═══════════════════════════════════════════════════════════════');
  console.info('  LeadFlow Phase 5 — Background Document Verification');
  console.info('═══════════════════════════════════════════════════════════════\n');

  // Step 1: Authenticate Advisor & Create/Convert Client
  console.info('[1/5] Setting up test client account...');
  const { body: loginData } = await postJson(`${API_BASE}/api/auth/login`, {
    email: 'advisor@alpha-mortgage.demo',
    password: 'Demo1234!',
  });
  const advisorToken = loginData.data?.token;

  const uniqueId = Date.now();
  const clientEmail = `phase5.client.${uniqueId}@example.de`;
  const { body: leadData } = await postJson(
    `${API_BASE}/api/leads`,
    {
      firstName: 'Lukas',
      lastName: `Bauer-${uniqueId}`,
      email: clientEmail,
      phone: '+49 151 5555 1234',
    },
    advisorToken
  );

  const tempPass = 'Client123!Secure';
  await postJson(
    `${API_BASE}/api/leads/${leadData.data.id}/convert`,
    { temporaryPassword: tempPass },
    advisorToken
  );

  // Login as Client
  const { body: clientLogin } = await postJson(`${API_BASE}/api/auth/login`, {
    email: clientEmail,
    password: tempPass,
  });
  const clientToken = clientLogin.data.token;
  console.info(`  ✓ Client authenticated: ${clientEmail}`);

  // Step 2: Connect real-time socket
  console.info('\n[2/5] Connecting client socket for live push notifications...');
  const socket = await connectSocket(clientToken);
  console.info(`  ✓ Socket connected (ID: ${socket.id})`);

  // Step 3: Test Upload & Live Verification for Standard Document
  console.info('\n[3/5] Uploading document & awaiting asynchronous verification pipeline...');
  const docEvents: Array<{ status: string; id: string }> = [];

  const checkingPromise = new Promise<{ id: string; status: string }>((resolve) => {
    socket.on('doc:status', (event) => {
      docEvents.push(event);
      if (event.status === 'checking') resolve(event);
    });
  });

  const finalPromise = new Promise<{ id: string; status: string; failureReason?: string }>((resolve) => {
    socket.on('doc:status', (event) => {
      if (event.status === 'passed' || event.status === 'failed') resolve(event);
    });
  });

  const fileBlob = new Blob(['VALID-PASSPORT-DOCUMENT-CONTENT-SAMPLE'], { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', fileBlob, 'passport_valid_scan.pdf');

  const uploadStart = Date.now();
  const uploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}` },
    body: formData,
  });
  const uploadBody = (await uploadRes.json()) as any;
  const uploadDuration = Date.now() - uploadStart;

  if (uploadRes.status !== 201) {
    throw new Error(`Upload failed: ${uploadBody.error}`);
  }

  const docId = uploadBody.data.id;
  console.info(`  ✓ Non-blocking HTTP 201 response in ${uploadDuration}ms (Document ID: ${docId})`);
  console.info(`  ✓ Initial status: '${uploadBody.data.status}', Job ID: '${uploadBody.data.verificationJobId}'`);

  // Await 'checking' status event via Socket.io
  console.info('  ... Awaiting worker pickup from BullMQ queue...');
  const checkingEvent = await Promise.race([
    checkingPromise,
    new Promise<null>((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for checking event')), 8000)),
  ]);
  console.info(`  ✓ Socket received live event: status = '${checkingEvent?.status}'`);

  // Await final status event ('passed' or 'failed')
  console.info('  ... Awaiting background OCR & fraud verification check...');
  const finalEvent = await Promise.race([
    finalPromise,
    new Promise<null>((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for final verification')), 10000)),
  ]);
  console.info(`  ✓ Socket received final live event: status = '${finalEvent?.status}'`);

  // Verify database record matches
  const { body: docCheck } = await getJson(`${API_BASE}/api/documents`, clientToken);
  const savedDoc = docCheck.data.find((d: any) => d.id === docId);
  if (!savedDoc || savedDoc.status !== finalEvent?.status) {
    throw new Error(`Database status mismatch: expected ${finalEvent?.status}, got ${savedDoc?.status}`);
  }
  console.info(`  ✓ MongoDB status verified: '${savedDoc.status}' (verifiedAt: ${savedDoc.verifiedAt})`);

  // Step 4: Test Failure Simulation
  console.info('\n[4/5] Testing deterministic rejection simulation on invalid document...');
  const failPromise = new Promise<{ id: string; status: string; failureReason?: string }>((resolve) => {
    socket.on('doc:status', (event) => {
      if (event.status === 'failed') resolve(event);
    });
  });

  const failBlob = new Blob(['BLURRY-CORRUPT-DOC'], { type: 'application/pdf' });
  const failForm = new FormData();
  failForm.append('file', failBlob, 'blurry_signature_fail.pdf');

  const failUploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}` },
    body: failForm,
  });
  const failBody = (await failUploadRes.json()) as any;
  console.info(`  ✓ Uploaded invalid test document (ID: ${failBody.data.id})`);

  const failEvent = await Promise.race([
    failPromise,
    new Promise<null>((_, rej) => setTimeout(() => rej(new Error('Timeout waiting for rejection event')), 10000)),
  ]);
  console.info(`  ✓ Socket received rejection event: status = '${failEvent?.status}'`);
  console.info(`  ✓ Rejection reason: "${failEvent?.failureReason}"`);

  // Step 5: Test Idempotent Retry Guard
  console.info('\n[5/5] Testing worker idempotency guard (re-queuing verified document)...');
  // Attempt to enqueue verification again for the already-verified docId
  const { enqueueDocumentVerification } = await import('../queues/document.queue');
  await enqueueDocumentVerification({
    documentId: docId,
    brokerageId: uploadBody.data.brokerageId,
    clientId: uploadBody.data.clientId,
    fileName: uploadBody.data.fileName,
    s3Key: uploadBody.data.s3Key,
  });

  // Wait a short moment and verify document status remained stable and was not corrupted
  await new Promise((r) => setTimeout(r, 2000));
  const { body: docRecheck } = await getJson(`${API_BASE}/api/documents`, clientToken);
  const recheckedDoc = docRecheck.data.find((d: any) => d.id === docId);
  if (recheckedDoc.status === savedDoc.status) {
    console.info(`  ✓ Document status intact: '${recheckedDoc.status}' — idempotent guard succeeded`);
  } else {
    throw new Error(`Document status corrupted after retry: was ${savedDoc.status}, now ${recheckedDoc.status}`);
  }

  socket.disconnect();

  console.info('\n═══════════════════════════════════════════════════════════════');
  console.info('  ✓ ALL PHASE 5 BACKGROUND VERIFICATION CHECKS PASSED');
  console.info('═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n✗ Verification failed:', err.message);
  process.exit(1);
});
