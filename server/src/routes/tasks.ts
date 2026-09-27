import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { requireRole } from '../middleware/requireRole';
import { validate } from '../middleware/validate';
import { CreateTaskSchema, UpdateTaskSchema } from '../middleware/schemas';
import { listTasks, createTask, updateTask, deleteTask } from '../controllers/task.controller';

export const taskRouter = Router();

taskRouter.use(authenticate);
taskRouter.use(requireRole('brokerage_admin', 'advisor'));

taskRouter.get('/',       listTasks);
taskRouter.post('/',      validate(CreateTaskSchema),  createTask);
taskRouter.patch('/:id',  validate(UpdateTaskSchema),  updateTask);
taskRouter.delete('/:id', deleteTask);
