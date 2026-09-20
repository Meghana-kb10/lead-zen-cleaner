// Four or five questions on one screen. Same options, same rules, fewer clicks:
// picking an option saves itself, and one button saves + moves to the next screen.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, History, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isExtraRequired, isStepDone, missingOn } from "@/bookingflow/journey";
import type { JStep } from "@/bookingflow/journey";
import type { FlowLead } from "@/bookingflow/types";
import { useBookingFlow } from "@/bookingflow/store";
import { SCREENS, currentScreen, screenIndex, screenProgress } from "./screens";
import type { Screen } from "./screens";
import { trySyncAuditLog } from "@/lib/backend-safety";

const inputType = (kind: JStep["kind"] | "TEXT" | "NUMBER" | "DATE" | "DATETIME") =>
  kind === "DATE" ? "date" : kind === "DATETIME" ? "datetime-local" : kind === "NUMBER" ? "number" : "text";

const fieldsOf = (st: JStep) => [st.field, ...(st.extra ?? []).map((x) => x.field)];

export function ScreenPanel({
  lead,
  screen,
  expert,
  onPrev,
  onNext,
  onNextCustomer,
  canPrev,
  canNext,
}: {
  lead: FlowLead;
  screen: Screen;
  expert: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onNextCustomer?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  const { answerStep, editFields } = useBookingFlow();
  const f = lead.f ?? {};
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [syncState, setSyncState] = useState<"IDLE" | "SYNCING" | "PENDING" | "SYNCED">("IDLE");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft({}), [screen.id, lead.id]);

  const now = currentScreen(f);
  const idx = screenIndex(screen.id);
  const nowIdx = screenIndex(now.id);
  const locked = idx > nowIdx && !expert;
  const p = screenProgress(f, screen);
  const val = (k: string) => draft[k] ?? f[k] ?? "";
  const put = (k: string, v: string) => setDraft((s) => ({ ...s, [k]: v }));

  const merged = useMemo(() => ({ ...f, ...draft }), [f, draft]);

  /** Writes one step's answers to the timeline. Returns false if it is half-filled. */
  function commit(st: JStep, source: Record<string, string>, quiet = false) {
    const full = { ...f, ...source };
    if (!full[st.field]) {
      if (!quiet) toast.error(`${st.title} still needs an answer`);
      return false;
    }
    const missingExtra = (st.extra ?? []).filter((x) => !full[x.field] && isExtraRequired(full, st, x.field));
    if (missingExtra.length) {
      if (!quiet) toast.error(`${st.title}: also fill ${missingExtra.map((m) => m.label).join(", ")}`);
      return false;
    }
    const payload: Record<string, string> = {};
    fieldsOf(st).forEach((k) => {
      if (source[k] !== undefined && source[k] !== f[k]) payload[k] = source[k]!;
    });
    if (Object.keys(payload).length === 0) return true;
    if (isStepDone(f, st)) editFields(lead.id, payload, "corrected on the 100x screen", st.key);
    else answerStep(lead.id, st.key, payload);
    return true;
  }

  /** Typed answers save themselves — on Enter, or the moment focus leaves the box. */
  function commitTyped(st: JStep) {
    if (!fieldsOf(st).some((k) => draft[k] !== undefined && draft[k] !== f[k])) return;
    if (!commit(st, draft, true)) return;
    setDraft((s) => {
      const copy = { ...s };
      fieldsOf(st).forEach((k) => delete copy[k]);
      return copy;
    });
    toast.success(`${st.title} saved`);
  }

  /** One click on an option is the answer — save it right away when nothing else is needed. */
  function chooseOption(st: JStep, value: string) {
    const nextDraft = { ...draft, [st.field]: value };
    const full = { ...f, ...nextDraft };
    const stillNeeded = (st.extra ?? []).filter((x) => !full[x.field] && isExtraRequired(full, st, x.field));
    if (stillNeeded.length === 0 && commit(st, nextDraft, true)) {
      setDraft((s) => {
        const copy = { ...s };
        fieldsOf(st).forEach((k) => delete copy[k]);
        return copy;
      });
      toast.success(`${st.title} saved`);
      return;
    }
    setDraft(nextDraft);
  }

  function saveAll(silent = false) {
    const touched = screen.steps.filter((st) =>
      fieldsOf(st).some((k) => draft[k] !== undefined && draft[k] !== f[k]),
    );
    if (touched.length === 0) {
      if (!silent) toast.error("Answer at least one question on this screen first");
      return touched.length === 0;
    }
    for (const st of touched) if (!commit(st, draft)) return false;
    setDraft({});
    toast.success(`${touched.length} ${touched.length === 1 ? "answer" : "answers"} saved on one screen`);
    return true;
  }

  const saveAndNext = useCallback(async () => {
    if (syncState === "SYNCING") return;
    const changes = { ...draft };
    
    if (Object.keys(changes).length > 0) {
      setSyncState("SYNCING");
      const saved = saveAll(true);
      if (!saved) {
        setSyncState("IDLE");
        return;
      }
      
      const synced = await trySyncAuditLog("lead", lead.id, `Updated ${screen.title}`, f, { ...f, ...changes }, "Saved & Next");
      setSyncState(synced ? "SYNCED" : "PENDING");
      if (!synced) toast.warning("Saved locally — sync pending", { duration: 2000 });
    }

    if (canNext) onNext?.();
    else if (onNextCustomer) onNextCustomer();
    else toast.success("This is the last screen");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, canNext, onNext, onNextCustomer, syncState, lead.id, screen.title, f]);

  /** Enter moves to the next box, and from the last box to the next screen. */
  function focusNextField(from: HTMLElement) {
    const list = rootRef.current?.querySelectorAll("input:not([disabled])");
    const boxes: HTMLInputElement[] = list ? (Array.from(list) as HTMLInputElement[]) : [];
    const i = boxes.indexOf(from as HTMLInputElement);
    const next: HTMLInputElement | undefined = i >= 0 ? boxes[i + 1] : undefined;
    if (next) {
      next.focus();
      next.select?.();
      return;
    }
    saveAndNext();
  }

  // Keyboard on the whole screen: Enter or Ctrl/Cmd+Enter moves on, arrows walk screens.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveAndNext();
        return;
      }
      if (e.key === "Enter" && !typing && el?.tagName !== "BUTTON") {
        e.preventDefault();
        saveAndNext();
        return;
      }
      if (!typing && (e.key === "ArrowRight" || e.key === "PageDown")) { e.preventDefault(); saveAndNext(); }
      if (!typing && (e.key === "ArrowLeft" || e.key === "PageUp")) { e.preventDefault(); if (canPrev) onPrev?.(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saveAndNext, canPrev, onPrev]);

  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const hasMeaningfulData = Boolean(
    (merged.area && merged.area.trim()) ||
    (merged.budget && merged.budget.trim()) ||
    (merged.roomType && merged.roomType.trim()) ||
    (merged.moveIn && merged.moveIn.trim())
  );

  const waDraft = useMemo(() => {
    if (!hasMeaningfulData) return null;
    const name = lead.name.trim().split(" ")[0] || "there";
    const area = merged.area?.trim();
    const budget = merged.budget?.trim();
    const roomType = merged.roomType?.trim();
    const moveIn = merged.moveIn?.trim();

    const parts: string[] = [];
    if (area) parts.push(`your ${area} preference`);
    if (budget) parts.push(`a ₹${budget} budget`);
    if (roomType) parts.push(`${roomType} room`);
    if (moveIn) parts.push(`move-in by ${moveIn}`);

    return `Hi ${name}, I’ve noted ${parts.join(" and ")}. I’ll check the available options and update you shortly.`;
  }, [hasMeaningfulData, merged.area, merged.budget, merged.roomType, merged.moveIn, lead.name]);

  function copyDraft() {
    if (!waDraft) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(waDraft)
        .then(() => {
          setCopyStatus("Copied!");
          toast.success("Draft copied to clipboard");
          setTimeout(() => setCopyStatus(null), 2000);
        })
        .catch((err) => {
          console.warn("Clipboard copy failed", err);
          setCopyStatus("Failed");
          toast.error("Could not copy to clipboard. Please copy manually.");
        });
    } else {
      toast.error("Clipboard access not supported in this environment");
    }
  }

  const firstUnansweredIndex = screen.steps.findIndex((st) => !isStepDone(f, st));

  return (
    <Card className="p-3 sm:p-4" ref={rootRef}>
      {/* Screen Title & Progress Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-1.5 text-xs">
          <Badge variant="outline" className="text-[10px]">Screen {idx + 1} of {SCREENS.length}</Badge>
          <span className="font-semibold text-foreground text-xs">{screen.title}</span>
          <span className="text-muted-foreground text-[10px]">({p.done}/{p.total} answered)</span>
          {locked && <Badge variant="outline" className="text-[10px]"><Lock className="mr-1 h-3 w-3" />Opens after “{now.title}”</Badge>}
        </div>
        {canPrev && (
          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => onPrev?.()}>
            <ArrowLeft className="mr-1 h-3 w-3" />Back
          </Button>
        )}
      </div>

      {locked ? (
        <p className="mt-3 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Finish “{now.title}” first. Still needed there: {now.steps.flatMap((s) => missingOn(f, s)).join(", ") || "an answer"}.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {screen.steps.map((st, i) => {
            const done = isStepDone(f, st);
            const isCurrentTask = !done && (i === firstUnansweredIndex || firstUnansweredIndex === -1);

            return (
              <div
                key={st.key}
                className={cn(
                  "rounded-lg transition-all",
                  isCurrentTask
                    ? "border-2 border-primary/70 bg-card p-3 shadow-xs ring-1 ring-primary/20"
                    : done
                      ? "border border-border/40 bg-muted/20 p-2.5 opacity-90 hover:opacity-100"
                      : "border border-dashed border-border/60 bg-muted/5 p-2.5 text-muted-foreground/85"
                )}
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={cn("text-xs", isCurrentTask ? "font-bold text-primary" : "text-muted-foreground")}>{i + 1}.</span>
                  <p className={cn("text-sm", isCurrentTask ? "font-semibold text-foreground" : done ? "font-normal text-muted-foreground" : "font-medium text-foreground/80")}>
                    {st.question}
                  </p>
                  {isCurrentTask && (
                    <Badge variant="default" className="text-[9px] h-4 px-1.5 font-semibold bg-primary text-primary-foreground">
                      Answer now
                    </Badge>
                  )}
                  {done && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25">
                      <Check className="mr-0.5 h-2.5 w-2.5" />Answered
                    </Badge>
                  )}
                  <span className="ml-auto text-[10px] text-muted-foreground">waiting on {st.waitingOn}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{st.help}</p>

                {st.kind === "CHOICE" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {st.options?.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => chooseOption(st, o.value)}
                        title={o.hint}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] transition",
                          val(st.field) === o.value ? "border-primary bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-accent",
                          o.effect && "border-destructive/50",
                        )}
                      >
                        {o.label}{o.effect === "ESCALATE" ? " → Tower" : o.effect === "CLOSE" ? " → closes" : ""}
                      </button>
                    ))}
                  </div>
                ) : (
                  <Input
                    className="mt-2 h-8 max-w-xs text-xs"
                    type={inputType(st.kind)}
                    placeholder={st.placeholder}
                    value={val(st.field)}
                    onChange={(e) => put(st.field, e.target.value)}
                    onBlur={() => commitTyped(st)}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter") return;
                      e.preventDefault();
                      commitTyped(st);
                      if (e.ctrlKey || e.metaKey) saveAndNext();
                      else focusNextField(e.currentTarget);
                    }}
                  />
                )}

                <div className="mt-2 flex flex-wrap gap-3">
                  {(st.extra ?? []).map((x) => (
                    <label key={x.field} className="text-[11px]">
                      <span className="text-muted-foreground">{x.label}{isExtraRequired(merged, st, x.field) ? " *" : ""}</span>
                      <Input
                        className="mt-1 h-8 w-[13rem] text-xs"
                        type={inputType(x.kind)}
                        placeholder={x.placeholder}
                        value={val(x.field)}
                        onChange={(e) => put(x.field, e.target.value)}
                        onBlur={() => commitTyped(st)}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          commitTyped(st);
                          if (e.ctrlKey || e.metaKey) saveAndNext();
                          else focusNextField(e.currentTarget);
                        }}
                      />
                    </label>
                  ))}
                </div>

                <StepHistory lead={lead} stepKey={st.key} />

                {!done && missingOn(merged, st).length > 0 && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-destructive">
                    <AlertTriangle className="h-3 w-3" />Still missing: {missingOn(merged, st).join(", ")}
                  </p>
                )}
              </div>
            );
          })}

          {/* Contextual WhatsApp draft — displayed prominently only when meaningful qualification data exists */}
          {waDraft && (
            <div className="mt-3 rounded-md border border-primary/30 bg-primary/5 p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">Customer WhatsApp Draft</p>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={copyDraft}>
                  {copyStatus || "Copy message"}
                </Button>
              </div>
              <p className="text-xs text-foreground select-all bg-background/70 p-2 rounded border border-border/40 font-mono text-[11px] leading-relaxed">
                {waDraft}
              </p>
            </div>
          )}

          {/* Action Bar — Save & Next as clear primary workflow action */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 mt-3">
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="h-8 px-2.5 text-xs" disabled={!canPrev} onClick={() => onPrev?.()}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />Previous
              </Button>
              {Object.keys(draft).length > 0 && (
                <Button size="sm" variant="ghost" className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setDraft({})}>
                  Clear edits
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="default"
                variant="default"
                className="h-8 px-4 text-xs font-semibold shadow-xs"
                onClick={saveAndNext}
                disabled={syncState === "SYNCING"}
              >
                {syncState === "SYNCING" ? "Saving..." : canNext ? "Save & Next" : "Save & Next Customer"}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground/80 mt-1">
            Keyboard: <kbd className="font-mono font-medium text-foreground">Enter</kbd> saves &amp; jumps next · <kbd className="font-mono font-medium text-foreground">Ctrl/⌘+Enter</kbd> jumps ahead · <kbd className="font-mono font-medium text-foreground">←</kbd> <kbd className="font-mono font-medium text-foreground">→</kbd> screens
          </p>
        </div>
      )}
    </Card>
  );
}

/** Who changed this answer, when, and what it was before. */
function StepHistory({ lead, stepKey }: { lead: FlowLead; stepKey: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const rows = (lead.events ?? []).filter((e) => e.stepKey === stepKey);
  if (rows.length === 0) return null;
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline">
        <History className="h-3 w-3" />{rows.length} change{rows.length === 1 ? "" : "s"} · last by {rows[rows.length - 1]!.actor}
      </button>
      {open && (
        <ol className="mt-1 space-y-0.5 rounded-md border bg-muted/30 p-2 text-[10px]">
          {[...rows].reverse().map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.actor}</span> · {mounted ? new Date(e.at).toLocaleString() : ""}
              {e.changes?.length
                ? ` — ${e.changes.map((c) => `${c.field}: ${c.from || "empty"} → ${c.to}`).join(", ")}`
                : e.detail ? ` — ${e.detail}` : ""}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
