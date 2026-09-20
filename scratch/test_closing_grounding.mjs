import { generateClosingMessage } from "../src/lib/commitments/closingDebrief.ts";

function assert(condition, msg) {
  if (!condition) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
}

console.log("=== Testing Strict Closing Desk Factual Grounding ===");

// Scenario 1: Open with step
const c1 = {
  id: "cc-1",
  leadName: "Rahul Sharma",
  leadPhone: "9876543210",
  promisedBy: "Meera",
  dueAt: new Date(Date.now() + 3600000).toISOString(),
  steps: ["Call back with token details"],
  status: "open",
  history: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  changeCount: 0
};

const msg1 = generateClosingMessage(c1);
console.log("1. Open with step message:\n", msg1);
assert(msg1.includes("Rahul"), "Must include customer name");
assert(msg1.includes("Meera"), "Must include closer name");
assert(msg1.includes("closing step we discussed"), "Must state closing step we discussed when step exists");
assert(msg1.includes("Call back with token details"), "Must include exact execution step");
assert(/I[’']ll follow up by/.test(msg1), "Must include deadline follow up");
assert(!msg1.includes("stay booking"), "Must NOT claim stay booking");
assert(!msg1.includes("confirmed"), "Must not claim booking confirmed");
assert(!msg1.includes("payment received"), "Must not claim payment received");

// Scenario 2: Open without step
const c2 = {
  ...c1,
  steps: []
};
const msg2 = generateClosingMessage(c2);
console.log("\n2. Open without step message:\n", msg2);
assert(msg2.includes("I’m following up on the closing commitment"), "Must use neutral closing commitment wording");
assert(/I[’']ll follow up by/.test(msg2), "Must include simple factual follow up");
assert(!msg2.includes("closing step we discussed"), "Must NOT claim closing step discussed when steps is empty");
assert(!msg2.includes("stay booking"), "Must NOT claim stay booking");
assert(!msg2.includes("undefined"), "Must not include undefined");

// Scenario 3: Kept without explicit nextStep
const c3 = {
  ...c1,
  status: "kept",
  closedAt: new Date().toISOString()
};
const msg3 = generateClosingMessage(c3);
console.log("\n3. Kept message (no nextStep):\n", msg3);
assert(msg3.includes("completed on our side"), "Must state closing commitment completed on our side");
assert(!msg3.includes("next step"), "Must NOT mention next step when no nextStep field exists");
assert(!msg3.includes("stay booking"), "Must NOT claim stay booking");
assert(!msg3.includes("Your booking is confirmed"), "Must NOT claim booking confirmed");
assert(!msg3.includes("Payment received"), "Must NOT claim payment received");

// Scenario 4: Broken without explicit nextStep
const c4 = {
  ...c1,
  status: "broken",
  problem: "Customer needs 24h to decide",
  note: "Spoke with father"
};
const msg4 = generateClosingMessage(c4);
console.log("\n4. Broken message (no nextStep):\n", msg4);
assert(msg4.includes("I’m following up on the closing commitment. We’ll continue from here."), "Must include exact specified neutral broken sentence");
assert(msg4.includes("Meera from Gharpayy"), "Must include closer signoff");
assert(!msg4.includes("next step"), "Must NOT mention next step when no nextStep field exists");
assert(!msg4.includes("logged the next step"), "Must NOT claim logged the next step without field");
assert(!msg4.includes("stay booking"), "Must NOT claim stay booking");

// Prohibited terms check across all messages
const forbiddenWords = [
  "stay booking",
  "receptive",
  "responsive",
  "eager",
  "enthusiastic",
  "disappointed",
  "payment received",
  "payment link",
  "booking is confirmed",
  "thanks for confirming your booking",
  "your booking is guaranteed",
  "room blocked"
];

for (const f of forbiddenWords) {
  assert(!msg1.toLowerCase().includes(f), `msg1 contains forbidden phrase: ${f}`);
  assert(!msg2.toLowerCase().includes(f), `msg2 contains forbidden phrase: ${f}`);
  assert(!msg3.toLowerCase().includes(f), `msg3 contains forbidden phrase: ${f}`);
  assert(!msg4.toLowerCase().includes(f), `msg4 contains forbidden phrase: ${f}`);
}

console.log("\nAll strict factual grounding checks PASSED!");
