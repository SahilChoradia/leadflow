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
