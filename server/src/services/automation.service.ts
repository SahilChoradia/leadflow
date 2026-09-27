import { PipelineStageConfig } from '../models/PipelineStageConfig';
import { EmailTemplate } from '../models/EmailTemplate';
import { Task } from '../models/Task';
import { enqueueEmail } from '../queues/email.queue';
import { emitToBrokerage } from '../config/socket';
import type { ILead } from '../models/Lead';
import type { TaskDto, PipelineStage } from '@leadflow/types';

function toTaskDto(task: any): TaskDto {
  return {
    id: task._id.toString(),
    brokerageId: task.brokerageId.toString(),
    leadId: task.leadId?.toString(),
    clientId: task.clientId?.toString(),
    title: task.title,
    assignedAdvisorId: task.assignedAdvisorId?.toString(),
    dueDate: task.dueDate?.toISOString(),
    isCompleted: task.isCompleted,
    isOverdue: task.dueDate ? task.dueDate < new Date() && !task.isCompleted : false,
    createdAt: task.createdAt.toISOString(),
  };
}

export async function triggerStageAutomation(lead: ILead, oldStage: PipelineStage | null) {
  if (lead.stage === oldStage) return;

  const brokerageId = lead.brokerageId.toString();
  const config = await PipelineStageConfig.findOne({ brokerageId, stage: lead.stage });

  if (!config) return;

  // 1. Create automation tasks
  if (config.tasks && config.tasks.length > 0) {
    const tasksToCreate = config.tasks.map((taskConfig) => {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + (taskConfig.dueDaysOffset || 0));

      return {
        brokerageId,
        leadId: lead._id,
        title: taskConfig.title,
        assignedAdvisorId:
          taskConfig.assigneePlaceholder === 'assigned_advisor' ? lead.assignedAdvisorId : undefined,
        dueDate,
      };
    });

    const createdTasks = await Task.insertMany(tasksToCreate);

    // Emit socket events for new tasks
    for (const task of createdTasks) {
      emitToBrokerage(brokerageId, 'task:created', toTaskDto(task));
    }
  }

  // 2. Send automated email
  if (config.emailTemplateId && lead.email) {
    const template = await EmailTemplate.findOne({ _id: config.emailTemplateId, brokerageId });
    if (template) {
      let html = template.bodyHtml;
      let subject = template.subject;

      // Replace placeholders
      const variables: Record<string, string> = {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        stage: lead.stage,
      };

      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        html = html.replace(regex, String(value));
        subject = subject.replace(regex, String(value));
      }

      await enqueueEmail({
        brokerageId,
        templateId: template._id.toString(),
        to: lead.email,
        subject,
        html,
      });
    }
  }
}
