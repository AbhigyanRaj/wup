/**
 * Test environment preset. Import FIRST (testApp.ts does) so config/env sees it:
 *
 *   import "./helpers/env";            // or just import from "./helpers/testApp"
 *
 * Sets NODE_ENV=test, fixed test secrets, BRIDGE_ALLOW_PRIVATE_HOSTS=true (so
 * bridges can point at MongoMemoryServer) and a silent logger. Values already
 * present in process.env win, so a test file can override before importing.
 */
const defaults: Record<string, string> = {
  NODE_ENV: "test",
  JWT_SECRET: "test_jwt_secret_0123456789abcdef0123456789abcdef",
  ENCRYPTION_KEY: "test_encryption_key_0123456789abcdef0123456789",
  CORS_ORIGIN: "http://localhost:3000,https://app.wuup.test",
  BRIDGE_ALLOW_PRIVATE_HOSTS: "true",
  LOG_LEVEL: "silent",
  GEMINI_API_KEY: "",
  MONGODB_URI: "mongodb://127.0.0.1:1/wuup-test-placeholder",
};

for (const [k, v] of Object.entries(defaults)) {
  if (process.env[k] === undefined) process.env[k] = v;
}

/** An Origin the test app allows (from CORS_ORIGIN). */
export const TEST_ORIGIN = "https://app.wuup.test";
