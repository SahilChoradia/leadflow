import { Router } from 'express';
import {
  uploadDocument,
  listDocuments,
  downloadDocument,
  uploadMiddleware,
} from '../controllers/document.controller';
import { authenticate } from '../middleware/authenticate';

export const documentRouter = Router();

documentRouter.use(authenticate);

// List documents for current client or filter by clientId
documentRouter.get('/', listDocuments);

// Download document file stream or presigned S3 URL
documentRouter.get('/:id/download', downloadDocument);

// Non-blocking upload endpoint (supports both client self-service and advisor uploads)
documentRouter.post('/upload', uploadMiddleware.single('file'), uploadDocument);

// Manual status update for admins/advisors
documentRouter.patch('/:id/status', async (req, res) => {
  const user = req.user!;
  if (user.role === 'client') {
    res.status(403).json({ success: false, error: 'Clients cannot modify document status' });
    return;
  }
  
  const { status, failureReason } = req.body;
  const doc = await require('../models/Document').DocumentModel.findOne({ _id: req.params.id, brokerageId: user.brokerageId });
  if (!doc) {
    res.status(404).json({ success: false, error: 'Document not found' });
    return;
  }
  
  doc.status = status;
  if (failureReason) doc.failureReason = failureReason;
  if (status === 'verified') doc.verifiedAt = new Date();
  await doc.save();
  
  require('../config/socket').emitToBrokerage(user.brokerageId!, 'doc:status', {
    id: doc._id.toString(),
    clientId: doc.clientId.toString(),
    status: doc.status,
    fileName: doc.fileName,
  });
  
  res.json({ success: true, data: doc });
});
