import type { DocumentStatus } from '@leadflow/types';

export interface VerificationResult {
  status: DocumentStatus;
  failureReason?: string;
  verifiedAt: Date;
  processingTimeMs: number;
}

const FAILURE_REASONS = [
  'Document illegible or scan resolution below 300 DPI.',
  'Signature on document does not match client record.',
  'Document expired or expiration date is not legible.',
  'Missing required pages or truncated content in scan.',
];

/**
 * Simulate OCR & anti-fraud verification check on a document.
 * Includes random delay (2.5s - 4.5s) and realistic outcome simulation.
 */
export async function simulateDocumentVerification(fileName: string): Promise<VerificationResult> {
  const startTime = Date.now();

  // Random delay between 2500ms and 4500ms
  const delayMs = Math.floor(Math.random() * 2000) + 2500;
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  const lowerName = fileName.toLowerCase();

  // Deterministic failure triggers for automated tests and demonstrations
  if (lowerName.includes('fail') || lowerName.includes('invalid') || lowerName.includes('reject')) {
    return {
      status: 'failed',
      failureReason: 'Document rejected: Security hologram or official stamp missing.',
      verifiedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  // Realistic simulation: 85% pass rate, 15% fail rate
  const passes = Math.random() < 0.85;

  if (passes) {
    return {
      status: 'verified',
      verifiedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
    };
  } else {
    const randomReason = FAILURE_REASONS[Math.floor(Math.random() * FAILURE_REASONS.length)];
    return {
      status: 'failed',
      failureReason: randomReason,
      verifiedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
    };
  }
}
