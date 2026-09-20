import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { useBookingFlow } from "@/bookingflow/store";
import { useHydrated } from "@/bookingflow/useHydrated";
import { health } from "@/bookingflow/engine";
import { CloseCommitButton } from "@/components/commitments/CloseCommitButton";
import { ContactActions } from "@/components/common/ContactActions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  AlertTriangle, CheckCircle2, Clock, History, Target, TrendingUp, XCircle,
  Copy, Search, Flame, ClipboardList, ArrowRightCircle, ClipboardCopy, ExternalLink, ShieldCheck, Keyboard,
} from "lucide-react";
import { HowButton } from "@/components/common/HowButton";
import { WINDOW_BY_ID, TONE_STYLE } from "@/lib/commitments/windows";
import {
  useCommitments, boardStats, reliabilityByPerson, problemBreakdown, isDueToday, isExpired, hoursLeft,
  markKept, promiseClose, type CloseCommitment,
} from "@/lib/commitments/store";
import { atRisk, boardDigest, groupByUrgency, ownersOf, riskFlags } from "@/lib/commitments/insights";
import { NotClosedDialog } from "./NotClosedDialog";
import { generateClosingMessage } from "@/lib/commitments/closingDebrief";
import { isValidUUID, trySyncAuditLog, trySyncNextAction } from "@/lib/backend-safety";

type Bucket = "today" | "overdue" | "open" | "settled";

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function countdown(h: number) {
  if (h < 0) return `${Math.abs(Math.round(h))}h overdue`;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m left`;
  if (h < 48) return `${Math.round(h)}h left`;
  return `${Math.round(h / 24)}d left`;
}

/** The Closing Board — every promise the team made, and whether it survived contact with reality. */
export function ClosingBoard() {
  const all = useCommitments();
  const [bucket, setBucket] = useState<Bucket>("today");
  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState<string>("all");
  const now = Date.now();

  const stats = boardStats(all, now);
  const people = useMemo(() => reliabilityByPerson(all), [all]);
  const problems = useMemo(() => problemBreakdown(all), [all]);
  const owners = useMemo(() => ownersOf(all), [all]);
  const risky = useMemo(() => atRisk(all, now).slice(0, 6), [all, now]);

  const list = useMemo(() => {
    const open = all.filter((c) => c.status === "open");
    const rows =
      bucket === "today" ? open.filter((c) => isDueToday(c, now))
      : bucket === "overdue" ? open.filter((c) => isExpired(c, now))
      : bucket === "open" ? open
      : all.filter((c) => c.status !== "open");
    const q = query.trim().toLowerCase();
    return rows.filter(
      (c) =>
        (owner === "all" || c.promisedBy === owner) &&
        (!q || c.leadName.toLowerCase().includes(q) || c.leadPhone.includes(q) || c.promisedBy.toLowerCase().includes(q)),
    );
  }, [all, bucket, now, query, owner]);

  const grouped = useMemo(
    () => (bucket === "settled" ? null : groupByUrgency(list, now)),
    [list, bucket, now],
  );
  const settledRows = useMemo(
    () => [...list].sort((a, b) => +new Date(b.closedAt ?? b.dueAt) - +new Date(a.closedAt ?? a.dueAt)),
    [list],
  );

  const copyDigest = async () => {
    const text = boardDigest(all, now);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Today's closing list copied", { description: "Paste it into the team chat and run the huddle off it." });
    } catch {
      toast.error("Could not copy — select the rows manually.");
    }
  };

  // Global power shortcuts on /closing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isTyping = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      const firstOpen = list.find((c) => c.status === "open");
      if (!firstOpen) return;

      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        markKept(firstOpen.id, firstOpen.promisedBy);
        if (isValidUUID(firstOpen.leadId)) {
          void trySyncAuditLog("close_commitment", firstOpen.leadId, "closing.kept", { status: "open" }, { status: "kept" });
        }
        toast.success(`${firstOpen.leadName} marked closed (Shortcut C)`);
      } else if (e.key === "3") {
        e.preventDefault();
        const updated = promiseClose({
          leadId: firstOpen.leadId, leadName: firstOpen.leadName, leadPhone: firstOpen.leadPhone,
          windowId: "3h", steps: firstOpen.steps, note: firstOpen.note, by: firstOpen.promisedBy,
        });
        if (isValidUUID(firstOpen.leadId)) {
          void trySyncAuditLog("close_commitment", firstOpen.leadId, "closing.moved", { dueAt: firstOpen.dueAt }, { dueAt: updated.dueAt });
        }
        toast.success(`${firstOpen.leadName} re-promised +3h (Shortcut 3)`);
      } else if (e.key === "4") {
        e.preventDefault();
        const updated = promiseClose({
          leadId: firstOpen.leadId, leadName: firstOpen.leadName, leadPhone: firstOpen.leadPhone,
          windowId: "24h", steps: firstOpen.steps, note: firstOpen.note, by: firstOpen.promisedBy,
        });
        if (isValidUUID(firstOpen.leadId)) {
          void trySyncAuditLog("close_commitment", firstOpen.leadId, "closing.moved", { dueAt: firstOpen.dueAt }, { dueAt: updated.dueAt });
        }
        toast.success(`${firstOpen.leadName} re-promised +24h (Shortcut 4)`);
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        const msg = generateClosingMessage(firstOpen);
        void navigator.clipboard.writeText(msg);
        toast.success(`Copied update for ${firstOpen.leadName} (Shortcut Y)`);
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        const cleanPhone = firstOpen.leadPhone?.replace(/[^0-9]/g, "") ?? "";
        if (cleanPhone) {
          const msg = generateClosingMessage(firstOpen);
          const url = `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}?text=${encodeURIComponent(msg)}`;
          window.open(url, "_blank", "noreferrer");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [list]);

  return (
    <div className="space-y-4">
      {/* ── 1. OUTCOME DIRECTIVE BANNER ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary shrink-0" />
          <div>
            <p className="font-semibold text-foreground">
              Deliver today's closing commitments: settle promises and prevent payment intent from slipping.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Resolve overdue promises first, act on commitments due soon, and follow up with factual customer updates.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium">
          {stats.expired > 0 && (
            <span className="rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-destructive font-semibold">
              {stats.expired} overdue
            </span>
          )}
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary font-semibold">
            {stats.today} due today
          </span>
          <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-muted-foreground">
            {stats.open} open
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-emerald-600 font-semibold">
            {stats.keptToday} kept today
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
        <Stat label="Closing today" value={stats.today} icon={<Target className="h-3 w-3" />} tone="primary" />
        <Stat label="Overdue promises" value={stats.expired} icon={<AlertTriangle className="h-3 w-3" />} tone={stats.expired ? "danger" : "ok"} />
        <Stat label="Live promises" value={stats.open} icon={<Clock className="h-3 w-3" />} />
        <Stat label="Kept today" value={stats.keptToday} icon={<CheckCircle2 className="h-3 w-3" />} tone="ok" />
        <Stat label="Broken" value={stats.broken} icon={<XCircle className="h-3 w-3" />} tone={stats.broken ? "danger" : "ok"} />
        <Stat label="Promise accuracy" value={stats.accuracy === null ? "—" : `${stats.accuracy}%`} icon={<TrendingUp className="h-3 w-3" />} tone="primary" />
      </div>

      {/* At-risk triage */}
      {risky.length > 0 && (
        <Card className="border-destructive/40 bg-destructive/5 p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-destructive" />
            <p className="text-xs font-semibold text-destructive">Needs a decision now — {risky.length}</p>
            <HowButton
              title="The at-risk list"
              why="These promises will break on their own if nobody touches them today. Working this list is worth more than making new promises."
              howToExecute={[
                "Start at the top: the row with the most flags is the one closest to being lost.",
                "Each row gets one of three outcomes today — closed, broken with a reason, or moved with a new plan.",
                "If a row has no steps ticked, write the plan before you leave it.",
              ]}
              whatNotToDo={["Do not skip a row because the customer is 'probably gone' — log it broken so the reason is counted."]}
              doneWhen="This card disappears."
            />
          </div>
          <div className="space-y-1.5">
            {risky.map(({ c, flags }) => (
              <div key={c.id} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="font-semibold">{c.leadName}</span>
                <span className="text-muted-foreground">{c.promisedBy} · due {fmt(c.dueAt)}</span>
                {flags.map((f) => (
                  <span key={f} className="rounded-full border border-destructive/40 bg-background px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    {f}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              ["today", `Closing today (${stats.today})`],
              ["overdue", `Overdue (${stats.expired})`],
              ["open", `All live (${stats.open})`],
              ["settled", `Settled (${stats.kept + stats.broken})`],
            ] as [Bucket, string][]
          ).map(([v, label]) => (
            <Button key={v} size="sm" variant={bucket === v ? "default" : "outline"} className="h-7 text-[11px]" onClick={() => setBucket(v)}>
              {label}
            </Button>
          ))}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={copyDigest}>
            <Copy className="h-3 w-3" /> Copy today's list
          </Button>
          <HowButton
            withText
            className="ml-1"
            title="How to run the Closing Board"
            why="This board is the only honest forecast of money landing. It is built from promises a named person made on a named lead, not from stage guesses."
            howToExecute={[
              "Copy today's list into the team chat and read every row out loud with the owner.",
              "Clear 'Overdue' before anything else: each one is kept, broken, or re-promised.",
              "Work the groups top-down — overdue, then the next 3 hours, then the rest of today.",
              "At end of day mark every settled promise so accuracy stays truthful.",
            ]}
            whatNotToDo={[
              "Do not silently delete a promise — move it, keep it, or break it so the history stays intact.",
              "Do not let a promise move more than twice without a manager on the call.",
              "Do not count a promise as revenue before payment lands.",
            ]}
            problemsThatCanOccur={[
              "Closers promise short windows to look good, then move them — watch the move count.",
              "Empty board usually means nobody is promising, not that there is no pipeline.",
            ]}
            branches={[
              { condition: "A promise moved 3+ times", then: "Reassign or downgrade the lead — the closer has lost the customer." },
              { condition: "Accuracy under 60% for a person", then: "Restrict them to 48h+ windows until it recovers." },
              { condition: "Overdue with no note", then: "Treat as broken and log it in the daily review." },
            ]}
            doneWhen="Today's bucket is empty and every row was settled kept, broken, or re-promised."
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                <Keyboard className="h-3 w-3 text-primary" /> Shortcuts
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 text-xs space-y-2">
              <div className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Keyboard className="h-3.5 w-3.5 text-primary" /> Power Shortcuts
              </div>
              <div className="space-y-1.5 text-muted-foreground text-[11px]">
                <div className="flex justify-between items-center">
                  <span>Mark It Closed</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">C</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Re-promise +3h</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">3</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Re-promise +24h</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">4</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Copy WhatsApp update</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">Y</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Open WhatsApp</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">W</kbd>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-border/60">
                  <span>Commit modal quick pick</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">1–5</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span>Commit modal save</span>
                  <kbd className="font-mono bg-muted px-1.5 py-0.5 rounded border border-border text-foreground font-semibold">⌘↵</kbd>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lead, phone or closer"
              className="h-7 w-56 pl-7 text-[11px]"
            />
          </div>
          <Chip active={owner === "all"} onClick={() => setOwner("all")}>Everyone</Chip>
          {owners.map((o) => (
            <Chip key={o} active={owner === o} onClick={() => setOwner(o)}>{o}</Chip>
          ))}
        </div>
      </div>

      {/* Rows */}
      {list.length === 0 && <ClosingCandidates />}

      {bucket === "settled"
        ? <div className="space-y-2">{settledRows.map((c) => <Row key={c.id} c={c} now={now} />)}</div>
        : grouped?.map((g) => (
            <section key={g.key} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h3
                  className={cn(
                    "text-xs font-bold uppercase tracking-wide",
                    g.meta.tone === "danger" && "text-destructive",
                    g.meta.tone === "hot" && "text-amber-600 dark:text-amber-400",
                    g.meta.tone === "warm" && "text-primary",
                    g.meta.tone === "cool" && "text-muted-foreground",
                  )}
                >
                  {g.meta.title}
                </h3>
                <span className="text-[10px] tabular-nums text-muted-foreground">{g.rows.length}</span>
                <span className="hidden text-[10px] text-muted-foreground sm:inline">— {g.meta.blurb}</span>
              </div>
              {g.rows.map((c) => <Row key={c.id} c={c} now={now} />)}
            </section>
          ))}

      {/* Why promises broke */}
      {problems.length > 0 && (
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <p className="text-xs font-semibold">Why promises broke</p>
            <HowButton
              title="The broken-promise reasons"
              why="This is the single most useful list on the floor: it tells you whether you are losing money to price, to inventory, to silence, or to your own follow-up. Fix the top reason and the accuracy number moves on its own."
              howToExecute={[
                "Read the top reason every morning and name one change that removes it this week.",
                "If 'I could not get to it in time' is top, the problem is capacity, not customers.",
                "If 'chose another property' is top, the problem is the pitch or the inventory.",
              ]}
              whatNotToDo={["Do not let people log the same vague reason forever without a fix."]}
              doneWhen="The top reason this week is different from the top reason last week."
            />
          </div>
          <div className="space-y-1">
            {problems.map((p) => {
              const max = problems[0].count || 1;
              return (
                <div key={p.problem} className="flex items-center gap-2 text-[11px]">
                  <span className="w-48 shrink-0 truncate">{p.problem}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-destructive" style={{ width: `${(p.count / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-semibold tabular-nums">{p.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Accuracy by person */}
      <Card className="p-3">
        <div className="mb-2 flex items-center gap-1.5">
          <p className="text-xs font-semibold">Promise accuracy by person</p>
          <HowButton
            title="Reading promise accuracy"
            why="Accuracy is kept ÷ settled. It tells you whose word can be put in front of the founder and whose cannot."
            howToExecute={[
              "Review weekly, never daily — one broken promise is noise.",
              "Read accuracy together with the move count: a high accuracy built on constantly moved dates is fake.",
              "Coach the lowest accuracy person on naming blockers, not on promising later.",
            ]}
            whatNotToDo={["Do not punish someone for promising short and missing once.", "Do not compare people with fewer than 5 settled promises."]}
            problemsThatCanOccur={["People stop promising at all to protect their number — watch for a falling promise count."]}
            branches={[{ condition: "Promised count drops week over week", then: "The person is hiding; ask for a promise on every hard-intent lead." }]}
            doneWhen="Every closer has at least one live promise and an accuracy above 70%."
          />
        </div>
        {people.length === 0 && <p className="text-[11px] text-muted-foreground">No promises recorded yet.</p>}
        <div className="space-y-1">
          {people.map((p) => (
            <div key={p.person} className="flex items-center gap-2 text-[11px]">
              <span className="w-32 truncate font-medium">{p.person}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", (p.accuracy ?? 0) >= 70 ? "bg-emerald-500" : "bg-destructive")}
                  style={{ width: `${p.accuracy ?? 0}%` }}
                />
              </div>
              <span className="w-10 text-right tabular-nums">{p.accuracy === null ? "—" : `${p.accuracy}%`}</span>
              <span className="hidden w-40 text-right text-muted-foreground sm:inline">
                {p.promised} promised · {p.kept} kept · {p.broken} broken · {p.changes} moves
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Row({ c, now }: { c: CloseCommitment; now: number }) {
  const def = WINDOW_BY_ID[c.windowId];
  const left = hoursLeft(c, now);
  const overdue = isExpired(c, now);
  const flags = riskFlags(c, now);
  const [showHistory, setShowHistory] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const customerMessage = useMemo(() => generateClosingMessage(c), [c]);

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(customerMessage);
      toast.success("Customer follow-up copied to clipboard!", {
        description: "Open WhatsApp to paste and send when ready.",
      });
    } catch {
      toast.error("Could not copy to clipboard.");
    }
  };

  const handleMarkKept = async () => {
    if (isActing) return;
    setIsActing(true);
    try {
      markKept(c.id, c.promisedBy);
      if (isValidUUID(c.leadId)) {
        void trySyncAuditLog(
          "close_commitment",
          c.leadId,
          "closing.kept",
          { status: "open", commitmentId: c.id, dueAt: c.dueAt },
          { status: "kept", commitmentId: c.id, closedAt: new Date().toISOString() },
          "Closing commitment marked kept"
        );
      }
      toast.success(`${c.leadName} marked closed`);
    } finally {
      setIsActing(false);
    }
  };

  const pushTo = async (windowId: "3h" | "24h" | "48h") => {
    if (isActing) return;
    setIsActing(true);
    try {
      const updated = promiseClose({
        leadId: c.leadId, leadName: c.leadName, leadPhone: c.leadPhone,
        windowId, steps: c.steps, note: c.note, by: c.promisedBy,
      });
      if (isValidUUID(c.leadId)) {
        void trySyncAuditLog(
          "close_commitment",
          c.leadId,
          "closing.moved",
          { dueAt: c.dueAt, changeCount: c.changeCount, windowId: c.windowId },
          { dueAt: updated.dueAt, changeCount: updated.changeCount, windowId },
          `Deadline moved +${windowId}`
        );
        void trySyncNextAction(c.leadId, "collect-payment", updated.dueAt, null);
      }
      toast.success(`${c.leadName} re-promised — ${WINDOW_BY_ID[windowId].short}`, {
        description: "The old deadline stays in the history.",
      });
    } finally {
      setIsActing(false);
    }
  };

  const cleanPhone = c.leadPhone?.replace(/[^0-9]/g, "") ?? "";
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone}?text=${encodeURIComponent(customerMessage)}` : "";

  return (
    <Card className={cn("p-3.5 transition-all shadow-xs", overdue && "border-destructive/60 bg-destructive/5 ring-1 ring-destructive/20", c.status === "kept" && "border-emerald-500/40 bg-emerald-500/5")}>
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          {/* WHO & STATUS LINE */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-bold text-foreground">{c.leadName}</span>
            <Badge variant="outline" className={cn("text-[10px] font-semibold", TONE_STYLE[def?.tone ?? "week"])}>
              {def?.short ?? c.windowId}
            </Badge>

            {/* Overdue vs Due In Indicator */}
            {c.status === "open" ? (
              overdue ? (
                <Badge variant="destructive" className="gap-1 text-[10px] font-bold uppercase tracking-wider">
                  <AlertTriangle className="h-3 w-3" /> Late {Math.abs(Math.round(left))}h
                </Badge>
              ) : (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-[10px] font-semibold text-primary">
                  <Clock className="h-3 w-3 mr-0.5" /> {countdown(left)}
                </Badge>
              )
            ) : (
              <Badge variant={c.status === "kept" ? "default" : "secondary"} className={cn("text-[10px] uppercase font-semibold", c.status === "kept" && "bg-emerald-600 hover:bg-emerald-700")}>
                {c.status === "kept" ? "Closed" : c.status}
              </Badge>
            )}

            {c.changeCount > 0 && (
              <Badge variant="secondary" className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                moved {c.changeCount}×
              </Badge>
            )}

            {/* Backend Sync Indicator */}
            {isValidUUID(c.leadId) ? (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600" title="Synchronized with cloud CRM">
                <ShieldCheck className="h-2.5 w-2.5" /> Synced
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 px-1.5 py-0.5 text-[9px] text-muted-foreground" title="Saved locally — sync pending">
                Local
              </span>
            )}
          </div>

          {/* WHEN & OWNER DETAILS */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted-foreground">
            <span><strong>Due:</strong> {fmt(c.dueAt)}</span>
            <span>·</span>
            <span><strong>Owner:</strong> <span className="font-medium text-foreground">{c.promisedBy}</span></span>
            {c.leadPhone && (
              <>
                <span>·</span>
                <span className="tabular-nums">{c.leadPhone}</span>
                <ContactActions compact phone={c.leadPhone} name={c.leadName} />
              </>
            )}
          </div>

          {/* WHAT: EXECUTION STEPS */}
          {c.steps?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground mr-1">Steps:</span>
              {c.steps.map((s) => (
                <span key={s} className="rounded-md border border-border bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                  {s}
                </span>
              ))}
            </div>
          )}

          {/* RISK FLAGS */}
          {flags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {flags.map((f) => (
                <span key={f} className="rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  {f}
                </span>
              ))}
            </div>
          )}

          {c.problem && <p className="mt-1 text-[11px] font-medium text-destructive">Did not close — {c.problem}</p>}
          {c.note && <p className="mt-1 text-[11px] text-foreground/80">Plan note: {c.note}</p>}
        </div>

        {/* WHAT NEXT: ACTIONS */}
        <div className="flex flex-wrap items-center gap-1.5 self-start">
          {c.status === "open" && (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={isActing}
                className="h-7 gap-1 text-[11px] font-semibold border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10"
                onClick={handleMarkKept}
                title="Mark It Closed (Shortcut: C)"
              >
                <CheckCircle2 className="h-3 w-3" /> It closed
                <kbd className="ml-1 text-[9px] font-mono px-1 rounded bg-emerald-500/15 border border-emerald-500/30">C</kbd>
              </Button>
              <NotClosedDialog commitmentId={c.id} leadName={c.leadName} actorName={c.promisedBy} leadId={c.leadId} />
              <Button
                size="sm"
                variant="ghost"
                disabled={isActing}
                className="h-7 gap-0.5 text-[11px] hover:bg-muted font-medium"
                onClick={() => pushTo("3h")}
                title="Re-promise into the next 3 hours (Shortcut: 3)"
              >
                <ArrowRightCircle className="h-3 w-3 text-primary" /> +3h
                <kbd className="ml-1 text-[9px] font-mono px-1 rounded bg-muted border border-border">3</kbd>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={isActing}
                className="h-7 text-[11px] hover:bg-muted font-medium"
                onClick={() => pushTo("24h")}
                title="Re-promise into tomorrow (Shortcut: 4)"
              >
                +24h
                <kbd className="ml-1 text-[9px] font-mono px-1 rounded bg-muted border border-border">4</kbd>
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1 text-[11px]"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-3 w-3" /> History
          </Button>
        </div>
      </div>

      {/* FACTUAL CUSTOMER WHATSAPP FOLLOW-UP AREA */}
      <div className="mt-2.5 rounded-md border bg-muted/20 p-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
          <span>Customer WhatsApp Follow-up</span>
          <div className="flex items-center gap-2">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-primary hover:underline font-semibold lowercase first-letter:uppercase"
                title="Open in WhatsApp (Shortcut: W)"
              >
                <ExternalLink className="h-3 w-3" /> Open in WhatsApp
                <kbd className="text-[9px] font-mono px-1 rounded bg-primary/10 border border-primary/30 text-primary">W</kbd>
              </a>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-5 px-1.5 text-[10px] text-primary"
              onClick={handleCopyMessage}
              title="Copy update (Shortcut: Y)"
            >
              <ClipboardCopy className="h-2.5 w-2.5 mr-1" /> Copy update
              <kbd className="ml-1 text-[9px] font-mono px-1 rounded bg-muted border border-border">Y</kbd>
            </Button>
          </div>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-foreground/90 italic">
          "{customerMessage}"
        </p>
      </div>

      {/* DETAILED AUDIT HISTORY */}
      {showHistory && (
        <div className="mt-2.5 space-y-1.5 border-t border-border pt-2 text-[11px]">
          <p className="font-semibold text-[10px] uppercase text-muted-foreground tracking-wider">
            Audit History ({c.history.length} event{c.history.length === 1 ? "" : "s"})
          </p>
          {c.history.map((e, i) => (
            <div key={i} className="rounded-md border bg-background/50 p-1.5 text-muted-foreground">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-semibold text-foreground uppercase">{e.kind}</span>
                <span>{fmt(e.at)} · by <strong className="text-foreground">{e.by}</strong></span>
              </div>
              {e.prevDueAt && (
                <p className="mt-0.5 text-[10px]">
                  Deadline changed: <span className="line-through">{fmt(e.prevDueAt)}</span> → <span className="font-semibold text-foreground">{e.dueAt ? fmt(e.dueAt) : "—"}</span>
                </p>
              )}
              {e.reason && <p className="mt-0.5 text-[10px] text-foreground font-medium">Why: {e.reason}</p>}
              {e.note && <p className="mt-0.5 text-[10px] text-foreground">Note: {e.note}</p>}
              {e.problem && <p className="mt-0.5 text-[10px] font-medium text-destructive">Problem: {e.problem}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] transition",
        active ? "border-primary bg-primary/10 font-medium text-primary" : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: number | string; icon: React.ReactNode; tone?: "ok" | "danger" | "primary" }) {
  return (
    <Card className="p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">{icon}{label}</div>
      <div
        className={cn(
          "mt-0.5 text-xl font-bold tabular-nums",
          tone === "ok" && "text-emerald-600",
          tone === "danger" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </div>
    </Card>
  );
}

/** An empty bucket is not an empty screen: show who can be promised right now,
 * with their number, the WhatsApp chat and the promise button on the row. */
function ClosingCandidates() {
  const hydrated = useHydrated();
  const { leads, me } = useBookingFlow();

  const rows = useMemo(() => {
    if (!hydrated) return [];
    return leads
      .map((l) => ({ l, f: l.f ?? {}, h: health(l) }))
      .filter(({ h, f }) => !h.closed && (Boolean(f["tourFeedback"]) || Boolean(f["bookingAmount"]) || Boolean(f["quotation"]) || h.stepNo >= 14))
      .sort((a, b) => b.h.stepNo - a.h.stepNo)
      .slice(0, 12);
  }, [leads, hydrated]);

  return (
    <Card className="p-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-sm font-semibold">Nobody has promised yet — here is who to promise</p>
        <span className="text-[11px] text-muted-foreground">
          These customers are past the tour or already quoted. Promise a close window on the row.
        </span>
      </div>

      {!hydrated && <p className="mt-3 text-xs text-muted-foreground">Loading your customers…</p>}
      {hydrated && rows.length === 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          No customer is past the tour yet. Move tours forward on Booking Flow and they appear here.
        </p>
      )}

      <div className="mt-2 space-y-1.5">
        {rows.map(({ l, f, h }) => (
          <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
            <span className="text-sm font-medium">{l.name}</span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{l.phone}</span>
            <ContactActions compact phone={l.phone} name={l.name} />
            <Badge variant="outline" className="text-[10px]">{h.stepNo}. {h.step?.title ?? "Checked in"}</Badge>
            <Badge variant="secondary" className="text-[10px]">{l.owner ?? "no owner"}</Badge>
            {f["rent"] && <span className="text-[11px] text-muted-foreground">₹{Number(f["rent"]).toLocaleString("en-IN")} rent</span>}
            <span className="text-[11px] text-muted-foreground">Next: {l.nextAction ?? "not set"}</span>
            <span className="ml-auto flex items-center gap-1.5">
              <CloseCommitButton leadId={l.id} leadName={l.name} leadPhone={l.phone} actorName={l.owner ?? me} size="sm" />
              <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                <Link to="/tower/leads/$id" params={{ id: l.id }}>Open</Link>
              </Button>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
