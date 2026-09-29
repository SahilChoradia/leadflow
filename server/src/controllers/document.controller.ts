import { Request, Response } from 'express';
import multer from 'multer';
import { DocumentModel, IDocument } from '../models/Document';
import { Client } from '../models/Client';
import { saveDocumentFile, getDocumentStream, getPresignedDownloadUrl } from '../config/storage';
import { emitToBrokerage, emitToUser } from '../config/socket';
import { enqueueDocumentVerification } from '../queues/document.queue';
import type { DocumentDto, ApiResponse } from '@leadflow/types';

// Multer memory storage (allows checking buffer before streaming to S3/disk)
export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Please upload a PDF, PNG, JPEG, or DOCX document.'));
    }
  },
});

function toDocumentDto(doc: any): DocumentDto {
  const clientObj = doc.clientId && typeof doc.clientId === 'object' && 'firstName' in doc.clientId ? doc.clientId : null;
  return {
    id:                doc._id.toString(),
    brokerageId:       doc.brokerageId.toString(),
    clientId:          clientObj ? clientObj._id.toString() : doc.clientId.toString(),
    clientName:        clientObj ? `${clientObj.firstName} ${clientObj.lastName}` : undefined,
    clientEmail:       clientObj ? clientObj.email : undefined,
    fileName:          doc.fileName,
    mimeType:          doc.mimeType,
    sizeBytes:         doc.sizeBytes,
    s3Key:             doc.s3Key,
    status:            doc.status,
    verificationJobId: doc.verificationJobId,
    failureReason:     doc.failureReason,
    uploadedAt:        doc.uploadedAt.toISOString(),
    verifiedAt:        doc.verifiedAt?.toISOString(),
  };
}

/**
 * Upload a document (as client or advisor on behalf of client).
 * POST /api/documents/upload
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const file = req.file;

  if (!file) {
    res.status(400).json({ success: false, error: 'No file uploaded' });
    return;
  }

  let clientId: string;
  let brokerageId = user.brokerageId;

  let clientName = '';
  if (user.role === 'client') {
    const client = await Client.findOne({ userId: user.id, brokerageId: user.brokerageId });
    if (!client) {
      res.status(404).json({ success: false, error: 'Client record not found' });
      return;
    }
    clientId = client._id.toString();
    clientName = `${client.firstName} ${client.lastName}`;
    brokerageId = client.brokerageId.toString();
  } else {
    // Advisor or admin must supply clientId in body
    const targetClientId = req.body.clientId;
    if (!targetClientId) {
      res.status(400).json({ success: false, error: 'clientId is required for staff uploads' });
      return;
    }
    const client = await Client.findOne({ _id: targetClientId, brokerageId });
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found in this brokerage' });
      return;
    }
    clientId = client._id.toString();
    clientName = `${client.firstName} ${client.lastName}`;
  }

  // Format file name: "Client Name-Document Name"
  const formattedFileName = `${clientName}-${file.originalname}`.replace(/[^a-zA-Z0-9.-_ ]/g, '');

  // Save to storage (S3 or local storage fallback)
  const { s3Key, sizeBytes } = await saveDocumentFile({
    buffer:       file.buffer,
    fileName:     formattedFileName,
    mimeType:     file.mimetype,
    brokerageId:  brokerageId!,
    clientId,
  });

  // Create document record with initial 'pending' status
  const document = await DocumentModel.create({
    brokerageId,
    clientId,
    fileName:   formattedFileName,
    mimeType:   file.mimetype,
    sizeBytes,
    s3Key,
    status:     'pending',
    uploadedAt: new Date(),
  });

  // (Removed automated AI worker verification per request. Verification is now manual by admin.)

  const docDto = toDocumentDto(document);

  // Broadcast real-time document upload event
  emitToBrokerage(brokerageId!, 'doc:status', {
    id:        docDto.id,
    clientId:  docDto.clientId,
    status:    docDto.status,
    fileName:  docDto.fileName,
  });

  res.status(201).json({
    success: true,
    data: docDto,
    message: 'Document uploaded successfully and queued for verification',
  });
}

/**
 * List documents for current client or specified client.
 * GET /api/documents
 */
export async function listDocuments(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const filter: Record<string, unknown> = {
    brokerageId: user.brokerageId,
  };

  if (user.role === 'client') {
    const client = await Client.findOne({ userId: user.id, brokerageId: user.brokerageId });
    if (!client) {
      res.json({ success: true, data: [] });
      return;
    }
    filter['clientId'] = client._id;
  } else if (req.query.clientId) {
    filter['clientId'] = req.query.clientId;
  }

  const documents = await DocumentModel.find(filter)
    .populate({
      path: 'clientId',
      select: 'firstName lastName email',
      options: { skipTenantCheck: true },
    })
    .sort({ uploadedAt: -1 });
  res.json({
    success: true,
    data: documents.map(toDocumentDto),
  });
}

/**
 * Download a document file stream or presigned URL.
 * GET /api/documents/:id/download
 */
export async function downloadDocument(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const query: Record<string, unknown> = { _id: req.params.id };
  if (user.role !== 'platform_admin') {
    query['brokerageId'] = user.brokerageId;
  }
  const queryOptions = user.role === 'platform_admin' ? { skipTenantCheck: true } : {};
  const doc = await DocumentModel.findOne(query, null, queryOptions);

  if (!doc) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  // Tenant / Client authorization check
  if (user.role === 'client') {
    const client = await Client.findOne({ userId: user.id, brokerageId: user.brokerageId });
    if (!client || doc.clientId.toString() !== client._id.toString()) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
  } else if (user.role !== 'platform_admin' && doc.brokerageId.toString() !== user.brokerageId) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  // Try S3 presigned URL first
  const presignedUrl = await getPresignedDownloadUrl(doc.s3Key);
  if (presignedUrl) {
    res.redirect(presignedUrl);
    return;
  }

  // Local storage stream
  try {
    const { stream, contentType } = await getDocumentStream(doc.s3Key);
    res.setHeader('Content-Type', contentType ?? doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);
    stream.pipe(res);
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message ?? 'File not found' });
  }
}

/**
 * Manually update document verification status (admin/advisor only).
 * PATCH /api/documents/:id/status
 */
export async function updateDocumentStatus(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  if (user.role === 'client') {
    res.status(403).json({ success: false, error: 'Clients cannot modify document status' });
    return;
  }

  const { status, failureReason } = req.body;

  if (!status || !['verified', 'failed', 'pending'].includes(status)) {
    res.status(400).json({ success: false, error: 'Invalid status. Must be: verified, failed, or pending' });
    return;
  }

  // platform_admin can access any doc; others are scoped to their brokerage
  const filter: Record<string, unknown> = { _id: req.params.id };
  if (user.role !== 'platform_admin') {
    filter['brokerageId'] = user.brokerageId;
  }

  const doc = await DocumentModel.findOne(filter);
  if (!doc) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }

  doc.status = status;
  if (failureReason) doc.failureReason = failureReason;
  if (status === 'verified') doc.verifiedAt = new Date();
  if (status !== 'failed') doc.failureReason = undefined;
  await doc.save();

  const brokerageId = doc.brokerageId.toString();
  emitToBrokerage(brokerageId, 'doc:status', {
    id:        doc._id.toString(),
    clientId:  doc.clientId.toString(),
    status:    doc.status,
    fileName:  doc.fileName,
    failureReason: doc.failureReason,
  });

  res.json({ success: true, data: toDocumentDto(doc) });
}
