import { vi } from "vitest";

export const app = {
  getPath: vi.fn(() => "/tmp/mock-app-data"),
};

export const safeStorage = {
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((str: string) => Buffer.from(`encrypted_${str}`)),
  decryptString: vi.fn((buf: Buffer) => buf.toString().replace(/^encrypted_/, "")),
};
