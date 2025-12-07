"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeStorage = exports.app = void 0;
const vitest_1 = require("vitest");
exports.app = {
    getPath: vitest_1.vi.fn(() => "/tmp/mock-app-data"),
};
exports.safeStorage = {
    isEncryptionAvailable: vitest_1.vi.fn(() => true),
    encryptString: vitest_1.vi.fn((str) => Buffer.from(`encrypted_${str}`)),
    decryptString: vitest_1.vi.fn((buf) => buf.toString().replace(/^encrypted_/, "")),
};
