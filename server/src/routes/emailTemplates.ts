import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import {
  CreateEmailTemplateSchema,
  UpdateEmailTemplateSchema,
  SendEmailSchema,
} from '../middleware/schemas';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  sendEmail,
} from '../controllers/emailTemplate.controller';

export const emailTemplateRouter = Router();

emailTemplateRouter.use(authenticate);
emailTemplateRouter.use(requireRole('brokerage_admin', 'advisor'));

emailTemplateRouter.get('/',    listTemplates);
emailTemplateRouter.post('/',   validate(CreateEmailTemplateSchema), createTemplate);
emailTemplateRouter.post('/send', validate(SendEmailSchema), sendEmail);  // must be before /:id
emailTemplateRouter.get('/:id',  getTemplate);
emailTemplateRouter.patch('/:id', validate(UpdateEmailTemplateSchema), updateTemplate);
emailTemplateRouter.delete('/:id', deleteTemplate);
