import type { CareGoal } from "./playbooks";

export interface DebriefInput {
  customerName: string;
  draftCode: string;
  goal: CareGoal;
  done: string;
  wentWell: string;
  wentBadly: string;
  problems: string;
  operatorName: string;
  resultNow: number;
  commitCount: number;
  property?: string;
  nextStep?: string;
  dueAt?: string;
}

const clean = (value: string, fallback: string) => (value.trim() ? value.trim() : fallback);

/** The message the operator copies and pastes into the team WhatsApp group. */
export function debriefMessage(input: DebriefInput) {
  const time = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const lines = [
    `*${input.draftCode} update · ${input.customerName}*`,
    `${input.operatorName} · ${time} · ${input.goal}`,
    "",
    `✅ Done: ${clean(input.done, "not written")}`,
    `👍 Went well: ${clean(input.wentWell, "nothing noted")}`,
    `👎 Went badly: ${clean(input.wentBadly, "nothing noted")}`,
    `⚠️ Problem / help needed: ${clean(input.problems, "none")}`,
  ];
  if (input.property) lines.push(`🏠 Property in play: ${input.property}`);
  if (input.nextStep) lines.push(`➡️ Next step: ${input.nextStep}${input.dueAt ? ` by ${new Date(input.dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}`);
  lines.push("", `📊 My day so far: ${input.resultNow}/${input.commitCount} ${input.goal.toLowerCase()} results`);
  return lines.join("\n");
}

export interface SmartDebriefContext {
  customerName: string;
  goal: CareGoal;
  operatorName: string;
  callOutcome?: string | null;
  property?: string | null;
  stage?: string | null;
  budget?: number | string | null;
  area?: string | null;
  moveIn?: string | null;
  roomType?: string | null;
  nextStep?: string | null;
  dueAt?: string | null;
  operatorNotes?: {
    done?: string;
    wentWell?: string;
    wentBadly?: string;
    problems?: string;
  };
}

export interface SmartDebriefResult {
  done: string;
  wentWell: string;
  wentBadly: string;
  problems: string;
  customerMessage: string;
}

/**
 * Factually grounded debrief notes and customer WhatsApp follow-up.
 * Strictly uses only verified application state; never invents customer sentiment,
 * preferences, objections, requests, WhatsApp activity status, or commitments.
 */
export function generateSmartDebrief(ctx: SmartDebriefContext): SmartDebriefResult {
  const firstName = ctx.customerName.split(" ")[0] || "there";
  const propertyText = ctx.property ? ctx.property.trim() : null;
  const operatorText = ctx.operatorName.trim() || "Gharpayy";

  // 1. Customer WhatsApp Message — strictly factual and concise
  let customerMessage = "";
  if (ctx.callOutcome === "connected") {
    if (propertyText) {
      customerMessage = `Hi ${firstName}, thanks for speaking with me. ${propertyText} is the property we currently have in play. I’ll follow up on the next step. — ${operatorText} from Gharpayy`;
    } else {
      customerMessage = `Hi ${firstName}, thanks for speaking with me. I’ll follow up on the next step from our conversation. — ${operatorText} from Gharpayy`;
    }
  } else if (
    ctx.callOutcome === "no-answer" ||
    ctx.callOutcome === "busy" ||
    ctx.callOutcome === "rejected" ||
    ctx.callOutcome === "wrong-number"
  ) {
    customerMessage = `Hi ${firstName}, I tried reaching you regarding your stay requirement. I’ll follow up again as per the next step. — ${operatorText} from Gharpayy`;
  } else {
    // Lead opened before or without an outbound call outcome
    if (propertyText) {
      customerMessage = `Hi ${firstName}, ${propertyText} is the property we currently have in play for your stay requirement. I’ll follow up on the next step. — ${operatorText} from Gharpayy`;
    } else {
      customerMessage = `Hi ${firstName}, I am reviewing your stay requirement. I’ll follow up on the next step. — ${operatorText} from Gharpayy`;
    }
  }

  // 2. Internal Debrief "Done" — only verified CRM state facts
  const doneParts: string[] = [];

  if (ctx.callOutcome === "connected") {
    doneParts.push("Call connected.");
  } else if (ctx.callOutcome) {
    const outcomeLabel = ctx.callOutcome.replace("-", " ");
    doneParts.push(`Outbound call attempted — ${outcomeLabel}.`);
  }

  if (propertyText) {
    doneParts.push(`Property in play: ${propertyText}.`);
  }

  if (ctx.area && ctx.area !== "—" && ctx.area.trim()) {
    doneParts.push(`Area recorded: ${ctx.area.trim()}.`);
  }

  if (ctx.budget) {
    doneParts.push(`Budget recorded: ₹${typeof ctx.budget === "number" ? ctx.budget.toLocaleString("en-IN") : ctx.budget}.`);
  }

  if (ctx.moveIn && ctx.moveIn !== "—" && ctx.moveIn.trim()) {
    doneParts.push(`Move-in recorded: ${ctx.moveIn.trim()}.`);
  }

  if (ctx.roomType && ctx.roomType !== "—" && ctx.roomType.trim()) {
    doneParts.push(`Room type recorded: ${ctx.roomType.trim()}.`);
  }

  if (ctx.nextStep && ctx.nextStep.trim()) {
    doneParts.push(`Next step: ${ctx.nextStep.trim()}.`);
  }

  if (ctx.dueAt) {
    try {
      const deadline = new Date(ctx.dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
      doneParts.push(`Deadline: ${deadline}.`);
    } catch {
      // Ignore unparseable date
    }
  }

  const done = doneParts.length > 0 ? doneParts.join(" ") : "Customer record reviewed.";

  // 3. Went Well / Went Badly / Problems — strictly no invented sentiment or objections
  const wentWell = ctx.operatorNotes?.wentWell?.trim() || "Not recorded";
  const wentBadly = ctx.operatorNotes?.wentBadly?.trim() || "Not recorded";
  const problems = ctx.operatorNotes?.problems?.trim() || "Not recorded";

  return {
    done,
    wentWell,
    wentBadly,
    problems,
    customerMessage,
  };
}

