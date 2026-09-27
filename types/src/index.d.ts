export type UserRole = 'platform_admin' | 'brokerage_admin' | 'advisor' | 'client';
export type PipelineStage = 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
export type DocumentStatus = 'pending' | 'checking' | 'passed' | 'failed';
export interface JwtPayload {
    sub: string;
    role: UserRole;
    brokerageId?: string;
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
export interface BrokerageDto {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    isActive: boolean;
}
export interface UserDto {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    brokerageId?: string;
    createdAt: string;
    isActive: boolean;
}
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
    externalId?: string;
    isDuplicate: boolean;
    duplicateOfId?: string;
    notes?: string;
    version: number;
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
    stage?: PipelineStage;
    assignedAdvisorId?: string;
    notes?: string;
    version: number;
}
export interface ClientDto {
    id: string;
    brokerageId: string;
    userId: string;
    leadId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    caseStatus: string;
    assignedAdvisorId?: string;
    createdAt: string;
}
export interface DocumentDto {
    id: string;
    brokerageId: string;
    clientId: string;
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
export interface EmailTemplateDto {
    id: string;
    brokerageId: string;
    name: string;
    subject: string;
    bodyHtml: string;
    placeholders: string[];
    createdAt: string;
    updatedAt: string;
}
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
export interface DashboardMetrics {
    stageCounts: Record<PipelineStage, number>;
    conversionRate: number;
    totalLeads: number;
    activeClients: number;
    overdueTaskCount: number;
    lastUpdatedAt: string;
}
export type SocketEvent = {
    type: 'lead:updated';
    payload: LeadDto;
} | {
    type: 'lead:created';
    payload: LeadDto;
} | {
    type: 'doc:status';
    payload: Pick<DocumentDto, 'id' | 'clientId' | 'status' | 'failureReason' | 'verifiedAt'>;
} | {
    type: 'task:created';
    payload: TaskDto;
} | {
    type: 'metrics:updated';
    payload: DashboardMetrics;
};
export interface ExternalLeadWebhookPayload {
    externalId: string;
    source: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    notes?: string;
}
//# sourceMappingURL=index.d.ts.map