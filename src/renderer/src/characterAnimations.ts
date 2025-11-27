export type CharacterState = "idle" | "listening" | "thinking" | "speaking" | "error";

export const FRAME_SIZE = 512;

export const animations: Record<CharacterState, { row: number; frames: number; fps: number; loop: boolean }> = {
  idle: { row: 0, frames: 4, fps: 4, loop: true },
  listening: { row: 1, frames: 4, fps: 4, loop: true },
  thinking: { row: 2, frames: 4, fps: 2, loop: true },
  speaking: { row: 3, frames: 4, fps: 6, loop: true },
  error: { row: 4, frames: 2, fps: 4, loop: false },
};
