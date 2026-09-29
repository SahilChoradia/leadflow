// ─── Role & Tenant ───────────────────────────────────────────────────────────

export type UserRole = 'platform_admin' | 'brokerage_admin' | 'advisor' | 'client';

export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';

export type DocumentStatus = 'pending' | 'verified' | 'failed';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;          // User._id
  role: UserRole;
  brokerageId?: string; // undefined for platform_admin
  iat?: number;
  exp?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  brokerageId?: string;
  name: string;
}

// ─── API response shapes ──────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Brokerage ────────────────────────────────────────────────────────────────

export interface BrokerageDto {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  isActive: boolean;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  brokerageId?: string;
  createdAt: string;
  isActive: boolean;
}

// ─── Lead ─────────────────────────────────────────────────────────────────────

export interface LeadDto {
  id: string;
  brokerageId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  stage: PipelineStage;
  assignedAdvisorId?: string;
  assignedAdvisor?: Pick<UserDto, 'id' | 'name' | 'email'>;
  source: string;
  externalId?: string;         // idempotency key from external source
  isDuplicate: boolean;
  duplicateOfId?: string;
  notes?: string;
  version: number;             // optimistic concurrency version
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source?: string;
  externalId?: string;
  notes?: string;
}

export interface UpdateLeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source?: string;
  stage?: PipelineStage;
  assignedAdvisorId?: string;
  notes?: string;
  version: number;             // must match current version — optimistic lock
}

// ─── Client ──────────────────────────────────────────────────────────────────

export interface ClientDto {
  id: string;
  brokerageId: string;
  userId: string;              // linked User account for portal login
  leadId: string;              // source lead
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  caseStatus: string;
  assignedAdvisorId?: string;
  createdAt: string;
}

// ─── Document ────────────────────────────────────────────────────────────────

export interface DocumentDto {
  id: string;
  brokerageId: string;
  clientId: string;
  clientName?: string;
  clientEmail?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  s3Key: string;
  status: DocumentStatus;
  verificationJobId?: string;
  failureReason?: string;
  uploadedAt: string;
  verifiedAt?: string;
}

// ─── Task ────────────────────────────────────────────────────────────────────

export interface TaskDto {
  id: string;
  brokerageId: string;
  leadId?: string;
  clientId?: string;
  title: string;
  assignedAdvisorId?: string;
  dueDate?: string;
  isCompleted: boolean;
  isOverdue: boolean;
  createdAt: string;
}

// ─── Email Template ───────────────────────────────────────────────────────────

export interface EmailTemplateDto {
  id: string;
  brokerageId: string;
  name: string;
  subject: string;
  bodyHtml: string;            // may contain {{placeholders}}
  placeholders: string[];      // e.g. ['clientName', 'advisorName']
  createdAt: string;
  updatedAt: string;
}

// ─── Pipeline Stage Config ────────────────────────────────────────────────────

export interface TaskConfigItem {
  title: string;
  assigneePlaceholder: 'assigned_advisor' | 'any';
  dueDaysOffset: number;
}

export interface PipelineStageConfigDto {
  id: string;
  brokerageId: string;
  stage: PipelineStage;
  emailTemplateId?: string;
  tasks: TaskConfigItem[];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  stageCounts: Record<PipelineStage, number>;
  conversionRate: number;       // won / (won + lost) expressed as 0–1
  totalLeads: number;
  activeClients: number;
  overdueTaskCount: number;
  lastUpdatedAt: string;
}

// ─── Socket.io event payloads ─────────────────────────────────────────────────

export type SocketEvent =
  | { type: 'lead:updated';    payload: LeadDto }
  | { type: 'lead:created';    payload: LeadDto }
  | { type: 'doc:status';      payload: Pick<DocumentDto, 'id' | 'clientId' | 'status' | 'failureReason' | 'verifiedAt'> }
  | { type: 'task:created';    payload: TaskDto }
  | { type: 'metrics:updated'; payload: DashboardMetrics };

// ─── Webhook ingestion ────────────────────────────────────────────────────────

export interface ExternalLeadWebhookPayload {
  externalId: string;          // idempotency key — unique in the external system
  source: string;              // e.g. 'typeform', 'fb_ads', 'manual'
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  notes?: string;
}
