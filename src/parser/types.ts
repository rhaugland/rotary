export type IntentType =
  | "create_task"
  | "update_status"
  | "add_comment"
  | "request_extension"
  | "unknown";

export interface ParsedIntent {
  intent: IntentType;
  taskTitle?: string;
  assigneeName?: string;
  dueDate?: string; // ISO date string
  status?: "open" | "in_progress" | "done";
  comment?: string;
  confidence: number;
}
