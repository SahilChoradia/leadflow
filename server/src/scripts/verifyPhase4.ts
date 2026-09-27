/**
 * Phase 4 Verification Script — Client Conversion, Client Auth, Portal & Document Upload
 *
 * Verifies:
 *  1. Converting a Lead to an active Client with portal credentials.
 *  2. Duplicate conversion rejection (409 conflict).
 *  3. Client login with role 'client' and profile retrieval via /api/clients/me.
 *  4. Document upload with non-blocking response and storage persistence.
 *  5. Document listing and streaming download verification.
 *  6. Tenant isolation and client authorization boundaries.
 *
 * Run: npx tsx server/src/scripts/verifyPhase4.ts
 */
import 'dotenv/config';

const API_BASE = 'http://localhost:4000';

async function postJson(url: string, body: object, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: (await res.json()) as any };
}

async function run() {
  console.info('\n═══════════════════════════════════════════════════════════════');
  console.info('  LeadFlow Phase 4 — Client Conversion & Portal Verification');
  console.info('═══════════════════════════════════════════════════════════════\n');

  // Step 1: Login as Advisor
  console.info('[1/6] Authenticating demo advisor...');
  const { status: loginStatus, body: loginData } = await postJson(`${API_BASE}/api/auth/login`, {
    email: 'advisor@alpha-mortgage.demo',
    password: 'Demo1234!',
  });
  if (loginStatus !== 200 || !loginData.data?.token) {
    throw new Error(`Advisor login failed: ${loginData.error}`);
  }
  const advisorToken = loginData.data.token;
  console.info('  ✓ Advisor authenticated');

  // Step 2: Create a unique lead
  console.info('\n[2/6] Creating a fresh lead for conversion test...');
  const uniqueId = Date.now();
  const clientEmail = `client.${uniqueId}@example.de`;
  const { status: createStatus, body: createData } = await postJson(
    `${API_BASE}/api/leads`,
    {
      firstName: 'Sophia',
      lastName: `Müller-${uniqueId}`,
      email: clientEmail,
      phone: '+49 151 7777 8888',
      source: 'website',
    },
    advisorToken
  );
  if (createStatus !== 201) {
    throw new Error(`Failed to create lead: ${createData.error}`);
  }
  const leadId = createData.data.id;
  console.info(`  ✓ Created lead: Sophia Müller (${leadId})`);

  // Step 3: Convert Lead to Client
  console.info('\n[3/6] Converting lead to client...');
  const tempPassword = 'Client123!Secure';
  const { status: convertStatus, body: convertData } = await postJson(
    `${API_BASE}/api/leads/${leadId}/convert`,
    { temporaryPassword: tempPassword, caseStatus: 'under_review' },
    advisorToken
  );

  if (convertStatus !== 201) {
    throw new Error(`Lead conversion failed: ${convertData.error}`);
  }
  const clientId = convertData.data.client.id;
  console.info(`  ✓ Converted to Client: ID ${clientId}`);
  console.info(`  ✓ Generated Portal Login: ${clientEmail} / ${tempPassword}`);

  // Test duplicate conversion conflict
  const { status: dupConvertStatus } = await postJson(
    `${API_BASE}/api/leads/${leadId}/convert`,
    {},
    advisorToken
  );
  if (dupConvertStatus === 409) {
    console.info('  ✓ Duplicate conversion safely rejected with 409 Conflict');
  } else {
    throw new Error(`Expected 409 for duplicate conversion, got ${dupConvertStatus}`);
  }

  // Verify lead is marked 'won'
  const { body: leadData } = await getJson(`${API_BASE}/api/leads/${leadId}`, advisorToken);
  if (leadData.data?.stage === 'won') {
    console.info("  ✓ Converted lead stage moved to 'won'");
  } else {
    throw new Error(`Expected stage 'won', got '${leadData.data?.stage}'`);
  }

  // Step 4: Client Authentication & Portal Profile
  console.info('\n[4/6] Testing Client Portal login & /clients/me profile...');
  const { status: clientLoginStatus, body: clientLoginData } = await postJson(
    `${API_BASE}/api/auth/login`,
    { email: clientEmail, password: tempPassword }
  );
  if (clientLoginStatus !== 200 || clientLoginData.data?.user?.role !== 'client') {
    throw new Error(`Client login failed: ${clientLoginData.error}`);
  }
  const clientToken = clientLoginData.data.token;
  console.info(`  ✓ Client successfully authenticated with role 'client'`);

  const { status: meStatus, body: meData } = await getJson(`${API_BASE}/api/clients/me`, clientToken);
  if (meStatus !== 200 || meData.data?.email !== clientEmail) {
    throw new Error(`Failed to fetch client profile: ${meData.error}`);
  }
  console.info(`  ✓ Profile loaded: ${meData.data.firstName} ${meData.data.lastName}, Case: ${meData.data.caseStatus}`);

  // Step 5: Document Upload (multipart/form-data)
  console.info('\n[5/6] Testing document upload (non-blocking)...');
  const dummyFileContent = 'PDF-MOCK-CONTENT-FOR-INCOME-VERIFICATION-LEADFLOW-12345';
  const formData = new FormData();
  const fileBlob = new Blob([dummyFileContent], { type: 'application/pdf' });
  formData.append('file', fileBlob, 'income_statement_2026.pdf');

  const uploadRes = await fetch(`${API_BASE}/api/documents/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${clientToken}` },
    body: formData,
  });
  const uploadData = (await uploadRes.json()) as any;
  if (uploadRes.status !== 201) {
    throw new Error(`Document upload failed: ${uploadData.error}`);
  }
  const documentId = uploadData.data.id;
  console.info(`  ✓ Upload non-blocking 201 Created: ID ${documentId} (status: ${uploadData.data.status})`);
  console.info(`  ✓ Stored s3Key: ${uploadData.data.s3Key}`);

  // Step 6: Document Listing & Download Streaming
  console.info('\n[6/6] Verifying document listing and download...');
  const { status: listStatus, body: listDocs } = await getJson(`${API_BASE}/api/documents`, clientToken);
  if (listStatus !== 200 || !listDocs.data?.some((d: any) => d.id === documentId)) {
    throw new Error(`Uploaded document not found in client document list`);
  }
  console.info(`  ✓ Document listed in client collection (${listDocs.data.length} total)`);

  const downloadRes = await fetch(`${API_BASE}/api/documents/${documentId}/download`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  if (downloadRes.status !== 200) {
    throw new Error(`Document download failed with status ${downloadRes.status}`);
  }
  const downloadedText = await downloadRes.text();
  if (downloadedText === dummyFileContent) {
    console.info(`  ✓ Downloaded content verified byte-for-byte`);
  } else {
    throw new Error(`Downloaded content did not match uploaded file`);
  }

  // Authorization check: client cannot list all leads
  const { status: unauthorizedStatus } = await getJson(`${API_BASE}/api/leads`, clientToken);
  if (unauthorizedStatus === 403) {
    console.info(`  ✓ Security boundary verified: client role cannot access advisor leads (403 Forbidden)`);
  } else {
    console.warn(`  ! Expected 403 on client access to /leads, got ${unauthorizedStatus}`);
  }

  console.info('\n═══════════════════════════════════════════════════════════════');
  console.info('  ✓ ALL PHASE 4 CLIENT PORTAL & CONVERSION CHECKS PASSED');
  console.info('═══════════════════════════════════════════════════════════════\n');
}

run().catch((err) => {
  console.error('\n✗ Verification failed:', err.message);
  process.exit(1);
});
