import { z } from "zod";

export const ChatMessageSchema = z.object({
  text: z.string().min(1).max(10000),
  model: z.enum(["gpt-4.1-mini", "gpt-4.1", "o1-mini"]),
  assistantId: z.string(),
  sessionId: z.string().optional(),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;
