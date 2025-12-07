"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessageSchema = void 0;
const zod_1 = require("zod");
exports.ChatMessageSchema = zod_1.z.object({
    text: zod_1.z.string().min(1).max(10000),
    model: zod_1.z.enum(["gpt-4.1-mini", "gpt-4.1", "o1-mini"]),
    assistantId: zod_1.z.string(),
    sessionId: zod_1.z.string().optional(),
});
