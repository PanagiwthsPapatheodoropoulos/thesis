/**
 * @fileoverview Central TypeScript type definitions for the Smart Resource Planner frontend.
 * All interfaces and types mirror the backend JPA entity models and API response shapes.
 * @module types
 */

// ─── Enums / Union Types ──────────────────────────────────────────────────────

/** User role enum matching backend UserRole. */
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'USER';

/** Task lifecycle status matching backend TaskStatus. */
export type TaskStatus = 'PENDING' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED' | 'ARCHIVED';

/** Task priority levels matching backend TaskPriority. */
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Assignment status matching backend TaskAssignmentStatus. */
export type AssignmentStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'COMPLETED';

/** How a task was assigned matching backend AssignedByType. */
export type AssignedByType = 'MANUAL' | 'AI' | 'SYSTEM';

/** Notification severity matching backend NotificationSeverity. */
export type NotificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';

/** Chat message type matching backend MessageType. */
export type MessageType = 'TEXT' | 'FILE' | 'SYSTEM';

// ─── Core Entities ────────────────────────────────────────────────────────────

/** Frontend representation of a User account. */
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  teamId?: string;
  isActive?: boolean;
  notificationPreferences?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLogin?: string;
}

/** Frontend representation of an Employee profile. */
export interface Employee {
  id: string;
  userId?: string;
  user?: User;
  firstName: string;
  lastName: string;
  position?: string;
  department?: string;
  hireDate?: string;
  hourlyRate?: number;
  maxWeeklyHours?: number;
  timezone?: string;
  profileImageUrl?: string;
  employeeSkills?: EmployeeSkill[];
  skills?: EmployeeSkill[];
  createdAt?: string;
  updatedAt?: string;
}

/** A skill registered in the global skill catalog. */
export interface Skill {
  id: string;
  name: string;
  category?: string;
  description?: string;
  createdAt?: string;
}

/** Represents an employee's proficiency in a specific skill. */
export interface EmployeeSkill {
  id: string;
  skillId?: string;
  skillName?: string;
  name?: string;
  skillCategory?: string;
  proficiencyLevel?: number;
  yearsOfExperience?: number;
  lastUsed?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Frontend representation of a Task. */
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedHours?: number | string;
  actualHours?: number;
  predictedHours?: number;
  predictionConfidence?: number;
  predictionModelVersion?: string;
  complexityScore?: number;
  complexityFactors?: string;
  taskCategory?: string;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  isEmployeeRequest?: boolean;
  isArchived?: boolean;
  requiresApproval?: boolean;
  teamId?: string;
  team?: Team;
  companyId?: string;
  createdBy?: User | string;
  createdByUserId?: string;
  createdByName?: string;
  teamName?: string;
  assignedEmployeeId?: string;
  assignments?: TaskAssignment[];
  requiredSkills?: TaskRequiredSkill[];
  requiredSkillIds?: string[];
  createdAt?: string;
  updatedAt?: string;
  feedbackSubmitted?: boolean;
  feedbackQualityScore?: number;
  scopeChangeCount?: number;
  reassignmentCount?: number;
}

/** A required skill entry on a task. */
export interface TaskRequiredSkill {
  id: string;
  skillId: string;
  skillName?: string;
  task?: Task;
}

/** Assignment linking an employee to a task. */
export interface TaskAssignment {
  id: string;
  taskId?: string;
  task?: Task;
  employeeId?: string;
  employee?: Employee;
  employeeName?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  assignedBy?: AssignedByType;
  assignedByUser?: User;
  assignedByUserId?: string;
  status?: AssignmentStatus;
  fitScore?: number;
  confidenceScore?: number;
  assignedDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** A comment on a task. */
export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  user?: User;
  comment: string;
  createdAt?: string;
  updatedAt?: string;
}

/** An audit log entry for task history. */
export interface TaskAuditLog {
  id: string;
  taskId: string;
  userId?: string;
  user?: User;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  description?: string;
  createdAt?: string;
}

/** A time entry logged against a task. */
export interface TaskTimeEntry {
  id: string;
  taskId: string;
  employeeId: string;
  hoursSpent: number;
  workDate: string;
  description?: string;
  createdAt?: string;
}

/** A team / organizational group. */
export interface Team {
  id: string;
  name: string;
  description?: string;
  members?: User[];
  users?: User[];
  tasks?: Task[];
  companyId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** A department within the company. */
export interface Department {
  name: string;
  description?: string;
  company?: string;
}

/** A notification delivered to a user. */
export interface Notification {
  id: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  isRead: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
  readAt?: string;
}

/** A chat message between users or in a team channel. */
export interface ChatMessage {
  id: string;
  senderId: string;
  senderName?: string;
  senderUsername?: string;
  receiverId?: string;
  receiverName?: string;
  receiverUsername?: string;
  teamId?: string;
  message: string;
  isRead?: boolean;
  messageType?: MessageType;
  createdAt: string;
  readAt?: string;
}

/** A conversation summary used in the chat sidebar. */
export interface Conversation {
  odl?: string;
  odg?: string;
  odlName?: string;
  odgName?: string;
  partnerId: string;
  partnerName: string;
  partnerUsername?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
  isTeam?: boolean;
  teamId?: string;
  teamName?: string;
}

/** A company entity. */
export interface Company {
  id: string;
  name: string;
  description?: string;
  createdAt?: string;
}

// ─── API Response Wrappers ────────────────────────────────────────────────────

/** Standard paginated API response. */
export interface PaginatedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first?: boolean;
  last?: boolean;
}

/** Auth API login response. */
export interface LoginResponse {
  token: string;
  user: User;
}

// ─── AI / ML Types ────────────────────────────────────────────────────────────

/** AI assignment suggestion returned by the AI service. */
export interface AISuggestion {
  employee_id: string;
  employee_name: string;
  fit_score: number;
  confidence_score: number;
  reasoning: string;
  skills_match?: string[];
  workload_status?: string;
}

/** AI assignment response. */
export interface AIAssignmentResponse {
  suggestions: AISuggestion[];
  task_id: string;
  model_version?: string;
}

/** AI duration prediction result. */
export interface DurationPrediction {
  predicted_hours: number;
  confidence_score: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  model_version: string;
}

/** AI complexity analysis result. */
export interface ComplexityAnalysis {
  overall_score: number;
  factors: ComplexityFactor[];
  recommendations?: string[];
  risk_level?: string;
}

/** Individual complexity factor within an analysis. */
export interface ComplexityFactor {
  name: string;
  score: number;
  weight: number;
  description?: string;
}

/** An extracted skill from AI skill-extraction. */
export interface ExtractedSkill {
  name: string;
  confidence: number;
  category: string;
  suggested_proficiency: number;
}

/** AI skills extraction response. */
export interface SkillExtractionResponse {
  extracted_skills: ExtractedSkill[];
  text_analyzed?: string;
}

/** AI chatbot response. */
export interface ChatbotResponse {
  response: string;
  sources?: string[];
}

// ─── Dashboard / Analytics Types ──────────────────────────────────────────────

/** Dashboard summary stats returned by the analytics API. */
export interface DashboardStats {
  totalTasks?: number;
  totalEmployees?: number;
  totalTeams?: number;
  totalAssignments?: number;
  completedTasks?: number;
  pendingTasks?: number;
  inProgressTasks?: number;
  tasksByStatus?: Record<string, number>;
  tasksByPriority?: Record<string, number>;
  recentTasks?: Task[];
  recentAssignments?: TaskAssignment[];
  [key: string]: unknown;
}

/** Workload data per employee for heatmaps and charts. */
export interface WorkloadData {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  maxHours: number;
  utilizationPercentage: number;
  assignedTasks?: number;
  completedTasks?: number;
}

/** Productivity data point for charts. */
export interface ProductivityData {
  date?: string;
  period?: string;
  tasksCompleted: number;
  hoursWorked: number;
  efficiency?: number;
  [key: string]: unknown;
}

// ─── Filter & Form Types ──────────────────────────────────────────────────────

/** Filters applied to task list queries. */
export interface TaskFilters {
  status?: string;
  priority?: string;
  search?: string;
  [key: string]: string | undefined;
}

/** Filters applied to employee list queries. */
export interface EmployeeFilters {
  department?: string;
  position?: string;
  search?: string;
  [key: string]: string | undefined;
}

/** Filters applied to team list queries. */
export interface TeamFilters {
  search?: string;
  [key: string]: string | undefined;
}

// ─── Context Types ────────────────────────────────────────────────────────────

/** Shape of the AuthContext value. */
export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  authReady: boolean;
  login: (userData: User, authToken: string) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
}

/** Shape of the ThemeContext value. */
export interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
}

/** Shape of the WebSocketContext value. */
export interface WebSocketContextType {
  connected: boolean;
  ready: boolean;
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
  send: (destination: string, body: any) => void;
  reconnect: () => void;
}

// ─── Component Prop Types ─────────────────────────────────────────────────────

/** Props for the Pagination component. */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalElements: number;
  size: number;
  onPageChange: (page: number, newSize?: number) => void;
  darkMode: boolean;
}

/** Props for the ProtectedRoute component. */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/** Props for the AIAssignmentModal component. */
export interface AIAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  darkMode?: boolean;
  onAssignmentCreated?: () => void;
  onAssign?: () => void;
}

/** Props for the TaskDetailsModal component. */
export interface TaskDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  darkMode?: boolean;
  onTaskUpdate?: (updatedTask: Task) => void;
}

/** Props for the SkillRadarChart component. */
export interface SkillRadarChartProps {
  skills: EmployeeSkill[];
  darkMode?: boolean;
  size?: number;
  title?: string;
}

/** Props for the WorkloadHeatmap component. */
export interface WorkloadHeatmapProps {
  employees?: WorkloadData[];
  workloadData?: any[];
  darkMode?: boolean;
}

/** Props for the EmployeeProductivityChart component. */
export interface EmployeeProductivityChartProps {
  data?: ProductivityData[];
  darkMode?: boolean;
  employeeId?: string;
}

/** Props for the TaskComplexityAnalyzer component. */
export interface TaskComplexityAnalyzerProps {
  taskData?: {
    title?: string;
    description?: string;
    priority?: string;
    requiredSkillIds?: string[];
  };
  title?: string;
  description?: string;
  onAnalysis?: (analysis: ComplexityAnalysis) => void;
  onComplexityDetected?: (score: number) => void;
  darkMode?: boolean;
}

/** Props for the TaskDurationPredictor component. */
export interface TaskDurationPredictorProps {
  taskData?: {
    priority?: string;
    complexityScore?: number;
    requiredSkillIds?: string[];
  };
  onPredictionReceived?: (hours: number) => void;
  darkMode?: boolean;
  [key: string]: any;
}

/** Props for the TaskSkillsExtractor component. */
export interface TaskSkillsExtractorProps {
  taskTitle?: string;
  taskDescription?: string;
  onSkillsExtracted?: (skills: string[]) => void;
  darkMode?: boolean;
}

/** Props for the SkillsInput component. */
export interface SkillsInputProps {
  employeeId?: string;
  initialSkills?: EmployeeSkill[];
  onSkillsChange?: (skills: EmployeeSkill[]) => void;
  readOnly?: boolean;
}

/** Props for the SkillsMultiSelect component. */
export interface SkillsMultiSelectProps {
  selectedSkills?: string[];
  onChange: (skills: string[]) => void;
  darkMode?: boolean;
  availableSkills?: Skill[];
}

/** Props for the ChatbotWidget component. */
export interface ChatbotWidgetProps {
  darkMode?: boolean;
}

// ─── Utility Types ────────────────────────────────────────────────────────────

/** Generic record used when the exact shape is unknown. */
export type AnyRecord = Record<string, unknown>;

/** Extend the global Window interface for STOMP client reference. */
declare global {
  interface Window {
    stompClient?: {
      deactivate: () => void;
    };
  }
}
