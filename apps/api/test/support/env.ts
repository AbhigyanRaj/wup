// Imported first by every WS-5 test so config/env parses a test environment.
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.JWT_SECRET = "test-jwt-secret-0123456789abcdef0123456789";
process.env.ENCRYPTION_KEY = "test-encryption-key-0123456789abcdef";
process.env.LEGACY_AUTO_SIGNUP = "true";
delete process.env.GEMINI_API_KEY;
delete process.env.SAMPLE_MONGODB_URI;

export {};
