import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import {
  listConfigs,
  upsertConfig,
  deleteConfig,
} from '../controllers/pipelineStageConfig.controller';

import { validate } from '../middleware/validate';
import { UpsertStageConfigSchema } from '../middleware/schemas';

export const pipelineStageConfigRouter = Router();

pipelineStageConfigRouter.use(authenticate);
// Only brokerage admins can configure automation rules
pipelineStageConfigRouter.use(requireRole('brokerage_admin'));

pipelineStageConfigRouter.get('/',          listConfigs);
pipelineStageConfigRouter.put('/:stage',    validate(UpsertStageConfigSchema), upsertConfig);
pipelineStageConfigRouter.delete('/:stage', deleteConfig);
