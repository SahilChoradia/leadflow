import { Request, Response } from 'express';
import { PipelineStageConfig, IPipelineStageConfig } from '../models/PipelineStageConfig';
import type { PipelineStageConfigDto, ApiResponse, PipelineStage } from '@leadflow/types';

function toDto(config: IPipelineStageConfig): PipelineStageConfigDto {
  return {
    id:              config._id.toString(),
    brokerageId:     config.brokerageId.toString(),
    stage:           config.stage,
    emailTemplateId: config.emailTemplateId?.toString(),
    tasks:           config.tasks ?? [],
  };
}

// GET /api/pipeline-stage-configs — returns all stages (may be partial list)
export async function listConfigs(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const configs = await PipelineStageConfig.find({ brokerageId }).sort({ stage: 1 });

  const response: ApiResponse<PipelineStageConfigDto[]> = {
    success: true,
    data: configs.map(toDto),
  };
  res.json(response);
}

// PUT /api/pipeline-stage-configs/:stage — upsert config for a specific stage
export async function upsertConfig(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const stage = req.params.stage as PipelineStage;

  const validStages: PipelineStage[] = ['new', 'contacted', 'qualified', 'won', 'lost'];
  if (!validStages.includes(stage)) {
    res.status(400).json({ success: false, error: `Invalid stage. Must be one of: ${validStages.join(', ')}` });
    return;
  }

  const { emailTemplateId, tasks } = req.body;

  const update: Record<string, unknown> = {};
  // Allow explicit null/empty to clear the template
  update['emailTemplateId'] = emailTemplateId || null;
  if (Array.isArray(tasks)) update['tasks'] = tasks;

  const config = await PipelineStageConfig.findOneAndUpdate(
    { brokerageId, stage },
    { $set: update },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );

  res.json({ success: true, data: toDto(config) });
}

// DELETE /api/pipeline-stage-configs/:stage — clear automation for a stage
export async function deleteConfig(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const stage = req.params.stage as PipelineStage;

  await PipelineStageConfig.findOneAndDelete({ brokerageId, stage });
  res.json({ success: true, message: `Automation for stage "${stage}" cleared` });
}
