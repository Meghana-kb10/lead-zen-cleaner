/**
 * Factual customer WhatsApp generator for Closing Desk.
 * Strictly uses only verified commitment state; never invents customer sentiment,
 * preferences, objections, payment/booking completion claims, or availability.
 */

export interface ClosingDebriefInput {
  leadName: string;
  leadPhone?: string;
  promisedBy: string;
  dueAt: string;
  steps?: string[];
  status: "open" | "kept" | "broken" | "cancelled";
  note?: string;
  problem?: string;
  changeCount?: number;
  bookingRef?: string;
  nextStep?: string;
}

/** Formats deadline into clean local representation (e.g., '06:00 pm' or '06:00 pm on 21 Sep'). */
export function formatClosingDeadline(dueAt: string): string {
  try {
    const d = new Date(dueAt);
    if (isNaN(d.getTime())) return "scheduled time";
    const nowD = new Date();
    const isSameDay = d.toDateString() === nowD.toDateString();
    const timeStr = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    return isSameDay ? timeStr : `${timeStr} on ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  } catch {
    return "scheduled time";
  }
}

/**
 * Generates a concise, 100% factually grounded customer WhatsApp follow-up.
 * Traceable directly to commitment fields.
 */
export function generateClosingMessage(input: ClosingDebriefInput): string {
  const firstName = input.leadName.split(" ")[0] || "there";
  const closer = input.promisedBy.trim() || "Gharpayy";
  const deadlineText = formatClosingDeadline(input.dueAt);
  const primaryStep = input.steps && input.steps.length > 0 ? input.steps[0].trim() : null;
  const nextStep = input.nextStep?.trim() || null;

  if (input.status === "kept") {
    // Settling a commitment on the closer's desk does NOT prove payment or booking completion.
    // Only mention next step if an actual next-step field exists.
    if (nextStep) {
      return `Hi ${firstName}, the closing commitment has been completed on our side. Our next step is ${nextStep}. — ${closer} from Gharpayy`;
    }
    return `Hi ${firstName}, the closing commitment has been completed on our side. — ${closer} from Gharpayy`;
  }

  if (input.status === "broken") {
    // Only mention next step if an actual next-step field exists.
    if (nextStep) {
      return `Hi ${firstName}, I’m following up on the closing commitment. Our next step is ${nextStep}. — ${closer} from Gharpayy`;
    }
    return `Hi ${firstName}, I’m following up on the closing commitment. We’ll continue from here. — ${closer} from Gharpayy`;
  }

  // Open / active commitment
  if (primaryStep) {
    return `Hi ${firstName}, I’m following up on the closing step we discussed. Our next closing step is ${primaryStep}. I’ll follow up by ${deadlineText}. — ${closer} from Gharpayy`;
  }

  return `Hi ${firstName}, I’m following up on the closing commitment. I’ll follow up by ${deadlineText}. — ${closer} from Gharpayy`;
}
