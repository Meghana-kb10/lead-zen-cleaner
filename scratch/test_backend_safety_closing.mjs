import { isValidUUID, trySyncAuditLog, trySyncNextAction } from "../src/lib/backend-safety.ts";

function assert(condition, msg) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

console.log("=== Testing Backend Safety Rules ===");

// 1. UUID validation
assert(isValidUUID("c0a80101-0000-4000-8000-000000000001") === true, "Valid UUIDv4 should pass");
assert(isValidUUID("bf-0") === false, "bf-0 prefix should be rejected");
assert(isValidUUID("bf-100") === false, "bf-100 prefix should be rejected");
assert(isValidUUID("cc-abc-123") === false, "cc-* ID should be rejected");
assert(isValidUUID("Meera") === false, "Owner name string should be rejected");
assert(isValidUUID("You") === false, "You string should be rejected");
assert(isValidUUID(undefined) === false, "Undefined should be rejected");
assert(isValidUUID(null) === false, "Null should be rejected");

// 2. trySyncAuditLog with invalid UUID must return false immediately
async function testSyncAuditInvalid() {
  const res = await trySyncAuditLog("close_commitment", "bf-0", "closing.promised", {}, {});
  assert(res === false, "trySyncAuditLog with bf-0 must return false and not query DB");
}

// 3. trySyncNextAction with invalid UUID must return false immediately
async function testSyncNextActionInvalid() {
  const res = await trySyncNextAction("bf-0", "call", "Call lead", new Date().toISOString(), "Meera");
  assert(res === false, "trySyncNextAction with bf-0 must return false and not query DB");
}

async function run() {
  await testSyncAuditInvalid();
  await testSyncNextActionInvalid();
  console.log("All Backend Safety checks PASSED!");
}

run();
