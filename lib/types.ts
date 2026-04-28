export type Role = "user" | "assistant" | "system";

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type ActiveModel = "groq" | "openrouter";

export interface ChatState {
  isLoading: boolean;
  isStreaming: boolean;
  activeModel: ActiveModel;
  error: string | null;
}
