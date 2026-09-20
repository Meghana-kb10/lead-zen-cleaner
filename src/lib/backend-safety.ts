import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Checks if a given string is a valid UUIDv4.
 */
export function isValidUUID(id: string | null | undefined): id is string {
  if (!id) return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return regex.test(id);
}

/**
 * Gets the current authenticated user's ID, or null if not logged in.
 */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return user.id;
  } catch {
    return null;
  }
}

/**
 * Attempts to write an audit log if the entity ID is a valid UUID.
 * Returns true if synced, false if it failed or was skipped (kept local).
 */
export async function trySyncAuditLog(
  entity: string,
  entityId: string,
  action: string,
  prev: Json,
  next: Json,
  reason?: string
): Promise<boolean> {
  if (!isValidUUID(entityId)) return false;

  try {
    const { error } = await supabase.from("audit_logs").insert({
      entity,
      entity_id: entityId,
      action,
      prev,
      next,
      reason,
    });

    if (error) {
      console.error("[Backend Safety] Failed to sync audit log:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Backend Safety] Exception syncing audit log:", err);
    return false;
  }
}

/**
 * Attempts to write a next action if the lead ID is a valid UUID.
 */
export async function trySyncNextAction(
  leadId: string,
  action: string,
  dueAt: string,
  ownerId?: string | null
): Promise<boolean> {
  if (!isValidUUID(leadId)) return false;
  
  // If an ownerId is provided but it's not a valid UUID (e.g., a name like "Diya"), we must not send it.
  const validOwnerId = isValidUUID(ownerId) ? ownerId : null;

  try {
    const { error } = await supabase.from("next_actions").insert({
      lead_id: leadId,
      kind: action,
      due_at: dueAt,
      status: "pending",
      owner_id: validOwnerId,
    });

    if (error) {
      console.error("[Backend Safety] Failed to sync next action:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Backend Safety] Exception syncing next action:", err);
    return false;
  }
}

/**
 * Attempts to record a call in call_records if authenticated and schema requirements are met.
 */
export async function trySyncCallRecord(params: {
  leadUlid: string;
  customerName?: string;
  outcome: string;
  agenda: string;
  durationSec?: number;
  messageNow?: string;
}): Promise<boolean> {
  try {
    const authUserId = await getAuthUserId();
    const { error } = await supabase.from("call_records").insert({
      lead_ulid: params.leadUlid,
      customer_name: params.customerName || null,
      outcome: params.outcome,
      agenda: params.agenda,
      duration_sec: params.durationSec ?? null,
      message_now: params.messageNow ?? null,
      operator_id: authUserId,
      called_at: new Date().toISOString(),
    });

    if (error) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

