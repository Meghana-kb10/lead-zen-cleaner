import { useMemo, useState } from "react";
import { ExternalLink, Copy, Clock, Plus, MessageSquare, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtMins, health } from "@/bookingflow/engine";
import { NEXT_ACTIONS } from "@/bookingflow/journey";
import type { FlowLead } from "@/bookingflow/types";
import { waLink, copyText } from "@/components/common/ContactActions";
import { trySyncNextAction } from "@/lib/backend-safety";
import { useBookingFlow } from "@/bookingflow/store";

interface CustomerContextRailProps {
  lead: FlowLead;
  nextAction: string;
  setNextAction: (action: string) => void;
  due: string;
  setDue: (due: string) => void;
  onLogActivity: () => void;
  onViewAllActivity?: () => void;
}

export function CustomerContextRail({
  lead,
  nextAction,
  setNextAction,
  due,
  setDue,
  onLogActivity,
  onViewAllActivity,
}: CustomerContextRailProps) {
  const { setNext } = useBookingFlow();
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const h = useMemo(() => health(lead), [lead]);

  // Qualification data extracted from real existing lead fields
  const area = lead.f?.area || lead.q?.area;
  const budget = lead.f?.budget || lead.q?.budget;
  const moveIn = lead.f?.moveIn || lead.q?.moveIn;
  const roomType = lead.f?.roomType || lead.q?.roomType;
  const owner = lead.owner;

  // WhatsApp draft generation based strictly on available qualification answers
  const hasMeaningfulData = Boolean(
    (area && area.trim()) ||
    (budget && budget.trim()) ||
    (roomType && roomType.trim()) ||
    (moveIn && moveIn.trim())
  );

  const waDraft = useMemo(() => {
    if (!hasMeaningfulData) return null;
    const name = lead.name.trim().split(" ")[0] || "there";
    const parts: string[] = [];
    if (area) parts.push(`your ${area.trim()} preference`);
    if (budget) parts.push(`a ₹${budget.trim()} budget`);
    if (roomType) parts.push(`${roomType.trim()} room`);
    if (moveIn) parts.push(`move-in by ${moveIn.trim()}`);

    return `Hi ${name}, I’ve noted ${parts.join(" and ")}. I’ll check the available options and update you shortly.`;
  }, [hasMeaningfulData, area, budget, roomType, moveIn, lead.name]);

  const chatUrl = useMemo(() => {
    return waLink(lead.phone, waDraft ?? undefined);
  }, [lead.phone, waDraft]);

  const handleCopyDraft = () => {
    if (!waDraft) return;
    copyText(waDraft, "WhatsApp Draft");
    setCopyStatus("Copied!");
    setTimeout(() => setCopyStatus(null), 2000);
  };

  // Recent 5 events from real lead history
  const recentEvents = useMemo(() => {
    return [...(lead.events ?? [])].slice(-5).reverse();
  }, [lead.events]);

  return (
    <aside className="w-full space-y-3 p-3 text-xs">
      {/* SECTION A: CUSTOMER SNAPSHOT */}
      <div className="rounded-lg border bg-card p-3 shadow-2xs">
        <div className="flex items-center justify-between border-b pb-1.5 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Customer Snapshot
          </span>
          {h.sla === "LATE" ? (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-medium">
              late {fmtMins(h.minutesLate)}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
              waiting on {h.waitingOn}
            </Badge>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground text-[11px]">Name</span>
            <span className="font-semibold text-foreground">{lead.name}</span>
          </div>

          <div className="flex justify-between items-baseline">
            <span className="text-muted-foreground text-[11px]">Phone</span>
            <span className="font-mono text-foreground">{lead.phone}</span>
          </div>

          {owner && (
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-[11px]">Owner</span>
              <Badge variant="secondary" className="text-[10px] h-4 font-medium px-1.5">
                {owner}
              </Badge>
            </div>
          )}

          {area && (
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-[11px]">Preferred Area</span>
              <span className="font-medium text-foreground">{area}</span>
            </div>
          )}

          {budget && (
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-[11px]">Monthly Budget</span>
              <span className="font-medium text-foreground">₹{budget}</span>
            </div>
          )}

          {moveIn && (
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-[11px]">Move-in Date</span>
              <span className="font-medium text-foreground">{moveIn}</span>
            </div>
          )}

          {roomType && (
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground text-[11px]">Room Type</span>
              <span className="font-medium text-foreground">{roomType}</span>
            </div>
          )}
        </div>
      </div>

      {/* SECTION B: NEXT ACTION */}
      <div className="rounded-lg border bg-card p-3 shadow-2xs">
        <div className="flex items-center justify-between border-b pb-1.5 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Next Action
          </span>
          {h.sla === "LATE" ? (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-medium animate-pulse">
              Overdue
            </Badge>
          ) : lead.nextActionAt ? (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 text-muted-foreground">
              Scheduled
            </Badge>
          ) : null}
        </div>

        <div className="space-y-2">
          <div>
            <p className="font-semibold text-foreground text-xs">
              {lead.nextAction || "No next action scheduled"}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
              {lead.owner && <span>Owner: <strong className="text-foreground font-medium">{lead.owner}</strong></span>}
              {lead.nextActionAt && (
                <span>
                  Due:{" "}
                  <strong className={cn("font-medium", h.sla === "LATE" ? "text-destructive" : "text-foreground")}>
                    {new Date(lead.nextActionAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                </span>
              )}
            </div>
          </div>

          {/* Functional Next Action Editor */}
          <div className="pt-2 border-t space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground">Update Next Action</p>
            <div className="space-y-1.5">
              <select
                className="h-7 w-full rounded-md border bg-background px-2 text-xs"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
              >
                {NEXT_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <Input
                type="datetime-local"
                className="h-7 w-full text-xs"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-7 w-full text-xs font-medium"
                onClick={async () => {
                  const isoDue = new Date(due).toISOString();
                  setNext(lead.id, nextAction, isoDue);
                  const synced = await trySyncNextAction(lead.id, nextAction, isoDue, lead.owner);
                  if (synced) toast.success("Next step locked and synced");
                  else toast.success("Next step locked locally (sync pending)");
                }}
              >
                Lock Next Action
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION C: WHATSAPP DRAFT */}
      <div className="rounded-lg border bg-card p-3 shadow-2xs">
        <div className="flex items-center justify-between border-b pb-1.5 mb-2">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              WhatsApp Draft
            </span>
          </div>
          {waDraft && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/10 text-primary border-primary/20">
              Ready
            </Badge>
          )}
        </div>

        {waDraft ? (
          <div className="space-y-2">
            <p className="text-xs text-foreground select-all bg-muted/40 p-2.5 rounded border border-border/40 font-mono text-[11px] leading-relaxed">
              {waDraft}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 text-xs"
                onClick={handleCopyDraft}
              >
                <Copy className="mr-1 h-3 w-3" />
                {copyStatus || "Copy message"}
              </Button>
              {chatUrl && (
                <a
                  href={chatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-7 px-2.5 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-medium transition-colors"
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Open WhatsApp
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded border border-dashed bg-muted/20 p-2.5 text-center text-muted-foreground">
            <p className="text-[11px]">No qualification answers entered yet.</p>
            <p className="text-[10px] mt-0.5 text-muted-foreground/80">
              Entering preferred area or budget will generate a draft automatically.
            </p>
          </div>
        )}
      </div>

      {/* SECTION D: RECENT ACTIVITY */}
      <div className="rounded-lg border bg-card p-3 shadow-2xs">
        <div className="flex items-center justify-between border-b pb-1.5 mb-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Activity ({lead.events?.length ?? 0})
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={onLogActivity}
          >
            <Plus className="h-3 w-3 mr-0.5" />Log
          </Button>
        </div>

        {recentEvents.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No timeline events recorded yet.</p>
        ) : (
          <ol className="space-y-2">
            {recentEvents.map((e, i) => (
              <li key={i} className="border-l-2 border-primary/40 pl-2 text-[11px]">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="font-medium text-foreground">{e.label}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0">
                    {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {e.detail && <p className="text-muted-foreground text-[10px] truncate">{e.detail}</p>}
                {e.actor && <p className="text-[9px] text-muted-foreground/70">by {e.actor}</p>}
              </li>
            ))}
          </ol>
        )}

        {lead.events && lead.events.length > 5 && onViewAllActivity && (
          <div className="mt-2.5 pt-1.5 border-t text-center">
            <button
              type="button"
              onClick={onViewAllActivity}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              View all {lead.events.length} events →
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
