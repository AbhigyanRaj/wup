// Imported first by the chat tests so config/env parses a test environment.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.JWT_SECRET ??= "test-jwt-secret-0123456789abcdef0123456789";
process.env.ENCRYPTION_KEY ??= "test-encryption-key-0123456789abcdef";
process.env.RESEARCH_ENABLED = "false";
delete process.env.GEMINI_API_KEY;

export {};
