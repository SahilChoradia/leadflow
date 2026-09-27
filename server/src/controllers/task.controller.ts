import { Request, Response } from 'express';
import { Task, ITask } from '../models/Task';
import { emitToBrokerage } from '../config/socket';
import type { TaskDto, ApiResponse, PaginatedResponse } from '@leadflow/types';

function toDto(task: ITask): TaskDto {
  const now = new Date();
  return {
    id:                 task._id.toString(),
    brokerageId:        task.brokerageId.toString(),
    leadId:             task.leadId?.toString(),
    clientId:           task.clientId?.toString(),
    title:              task.title,
    assignedAdvisorId:  task.assignedAdvisorId?.toString(),
    dueDate:            task.dueDate?.toISOString(),
    isCompleted:        task.isCompleted,
    isOverdue:          !task.isCompleted && !!task.dueDate && task.dueDate < now,
    createdAt:          task.createdAt.toISOString(),
  };
}

// GET /api/tasks
export async function listTasks(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const showCompleted = req.query.completed === 'true';
  const page  = Math.max(1, parseInt(String(req.query.page  ?? 1)));
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? 50))));
  const skip  = (page - 1) * limit;

  const filter: Record<string, unknown> = { brokerageId };
  if (!showCompleted) filter['isCompleted'] = false;

  const [tasks, total] = await Promise.all([
    Task.find(filter).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(limit),
    Task.countDocuments(filter),
  ]);

  const response: ApiResponse<PaginatedResponse<TaskDto>> = {
    success: true,
    data: {
      items:      tasks.map(toDto),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
  res.json(response);
}

// POST /api/tasks
export async function createTask(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const { title, leadId, clientId, assignedAdvisorId, dueDate } = req.body;

  if (!title) {
    res.status(400).json({ success: false, error: 'title is required' });
    return;
  }

  const task = await Task.create({
    brokerageId,
    title,
    leadId:            leadId    || undefined,
    clientId:          clientId  || undefined,
    assignedAdvisorId: assignedAdvisorId || undefined,
    dueDate:           dueDate   ? new Date(dueDate) : undefined,
  });

  const dto = toDto(task);
  emitToBrokerage(brokerageId, 'task:created', dto);
  res.status(201).json({ success: true, data: dto });
}

// PATCH /api/tasks/:id
export async function updateTask(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const { title, isCompleted, dueDate, assignedAdvisorId } = req.body;

  const update: Record<string, unknown> = {};
  if (title             !== undefined) update['title']             = title;
  if (isCompleted       !== undefined) update['isCompleted']       = isCompleted;
  if (dueDate           !== undefined) update['dueDate']           = dueDate ? new Date(dueDate) : null;
  if (assignedAdvisorId !== undefined) update['assignedAdvisorId'] = assignedAdvisorId || null;

  const task = await Task.findOneAndUpdate(
    { _id: req.params.id, brokerageId },
    { $set: update },
    { new: true, runValidators: true },
  );

  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }

  res.json({ success: true, data: toDto(task) });
}

// DELETE /api/tasks/:id
export async function deleteTask(req: Request, res: Response): Promise<void> {
  const brokerageId = req.user!.brokerageId!;
  const task = await Task.findOneAndDelete({ _id: req.params.id, brokerageId });

  if (!task) {
    res.status(404).json({ success: false, error: 'Task not found' });
    return;
  }
  res.json({ success: true, message: 'Task deleted' });
}
