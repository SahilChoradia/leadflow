import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'documents');

// Ensure local uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Check if real S3 credentials are configured
const isS3Configured = Boolean(
  process.env.S3_ACCESS_KEY_ID &&
  process.env.S3_ACCESS_KEY_ID !== 'your_access_key_here' &&
  process.env.S3_SECRET_ACCESS_KEY &&
  process.env.S3_SECRET_ACCESS_KEY !== 'your_secret_key_here'
);

let s3Client: S3Client | null = null;
if (isS3Configured) {
  s3Client = new S3Client({
    region: process.env.S3_REGION ?? 'eu-central-1',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: !!process.env.S3_ENDPOINT,
  });
}

export interface SaveFileOptions {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  brokerageId: string;
  clientId: string;
}

export interface SaveFileResult {
  s3Key: string;
  sizeBytes: number;
}

/**
 * Save an uploaded document to either S3 or local disk storage.
 */
export async function saveDocumentFile(options: SaveFileOptions): Promise<SaveFileResult> {
  const { buffer, fileName, mimeType, brokerageId, clientId } = options;
  const timestamp = Date.now();
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const s3Key = `brokerages/${brokerageId}/clients/${clientId}/${timestamp}-${safeName}`;
  const sizeBytes = buffer.length;

  if (s3Client && isS3Configured) {
    const bucket = process.env.S3_BUCKET ?? process.env.S3_BUCKET_NAME ?? 'leadflow-documents';
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
      })
    );
    console.info(`[storage] Uploaded to S3: ${s3Key} (${sizeBytes} bytes)`);
  } else {
    // Local storage fallback
    const localFilePath = path.join(UPLOADS_DIR, `${timestamp}-${safeName}`);
    await fs.promises.writeFile(localFilePath, buffer);
    console.info(`[storage] Saved to local storage: ${localFilePath} (${sizeBytes} bytes)`);
  }

  return { s3Key, sizeBytes };
}

/**
 * Retrieve file stream for downloading or processing.
 */
export async function getDocumentStream(s3Key: string): Promise<{ stream: Readable; contentType?: string }> {
  if (s3Client && isS3Configured) {
    const bucket = process.env.S3_BUCKET ?? process.env.S3_BUCKET_NAME ?? 'leadflow-documents';
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: s3Key,
    });
    const res = await s3Client.send(command);
    return {
      stream: res.Body as Readable,
      contentType: res.ContentType,
    };
  }

  // Local storage: extract base filename from s3Key
  const fileName = path.basename(s3Key);
  const localFilePath = path.join(UPLOADS_DIR, fileName);

  if (!fs.existsSync(localFilePath)) {
    throw new Error('Document file not found on disk');
  }

  return {
    stream: fs.createReadStream(localFilePath),
  };
}

/**
 * Generate a presigned download URL (if S3 is configured).
 */
export async function getPresignedDownloadUrl(s3Key: string, expiresIn = 3600): Promise<string | null> {
  if (!s3Client || !isS3Configured) return null;
  const bucket = process.env.S3_BUCKET ?? process.env.S3_BUCKET_NAME ?? 'leadflow-documents';
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}
