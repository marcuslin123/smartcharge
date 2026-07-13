import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Battery, MapPin, Home, Zap, Clock, Users, CheckCircle2, AlertTriangle,
  Plug, ArrowRight, Leaf, Ghost, ShieldCheck, X, Calendar, Plus, CalendarClock, Bell,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Slider, Switch, Label } from "@/components/ui";
import { apiPost, cn, fmtMin } from "@/lib/utils";

function YourSession() {
  const { yourSession, snapshot, startCharging, checkOut } = useApp();
  if (!yourSession) return null;

  // Phase 1: "on my way" — flagged heading-here, not yet plugged in.
  if (yourSession.phase === "incoming") {
    return (
      <Card className="border-sky-400/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-sky-300" />
              <h3 className="font-semibold">Planning to use {yourSession.port}</h3>
            </div>
            <Badge className="bg-sky-400/15 text-sky-300 border-sky-400/30">Watching</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Colleagues can see you're eyeing this port — but it's <b className="text-foreground">not saved for you</b>.
            Get there fast; whoever plugs in first wins. Tap below once you've physically plugged in{yourSession.clears_by ? ` (clears by ${yourSession.clears_by} otherwise)` : ""}.
          </p>
          <Button variant="accent" className="mt-3 w-full"
            onClick={() => startCharging(yourSession.port, yourSession.charge_minutes)}>
            <Plug className="h-4 w-4" /> I've plugged in
          </Button>
          <button onClick={checkOut} className="mt-2 w-full text-center text-xs text-muted-foreground hover:text-foreground">
            Changed your mind? Release {yourSession.port}
          </button>
        </CardContent>
      </Card>
    );
  }

  // Phase 2: actually charging.
  const p = snapshot?.ports.find((x) => x.id === yourSession.port);
  const full = p?.status === "idle_you";
  return (
    <Card className={cn(full && "border-accent/60 glow")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-accent" />
            <h3 className="font-semibold">Your session · {yourSession.port}</h3>
          </div>
          <Badge variant={full ? "accent" : "default"}>{full ? "Fully charged" : "Charging"}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {full
            ? "You're done — please move your vehicle and check out so the next person can charge."
            : `Charging — we'll nudge you ~10 min before you're set, unplug reminder by ${yourSession.checkout_by}.`}
        </p>
        <Button variant={full ? "accent" : "outline"} className="mt-3 w-full" onClick={checkOut}>
          <CheckCircle2 className="h-4 w-4" /> Check out
        </Button>
      </CardContent>
    </Card>
  );
}

function RecCard({ rec, onCheckIn, onSteal }) {
  const { joinQueue } = useApp();
  if (!rec) return null;

  if (rec.mode === "no_charge" || rec.mode === "home") {
    const Icon = rec.mode === "home" ? Home : Leaf;
    return (
      <Card className="border-emerald-400/40">
        <CardContent className="p-5 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400/15">
            <Icon className="h-7 w-7 text-emerald-300" />
          </div>
          <h3 className="text-lg font-bold">You're good to go</h3>
          <p className="mt-1 text-sm text-muted-foreground">{rec.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (rec.mode === "charge_now") {
    return (
      <Card className="border-emerald-400/50 glow">
        <CardContent className="p-5">
          {/* Hero: Charger */}
          <div className="flex items-center justify-between">
            <Badge className="bg-emerald-400/15 text-emerald-300 border-emerald-400/30 gap-1"><Zap className="h-3 w-3" /> Best open port</Badge>
            {rec.others_looking > 0 && (
              <Badge variant="amber" className="gap-1 text-xs"><Users className="h-3 w-3" /> {rec.others_looking} looking</Badge>
            )}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/15">
              <Plug className="h-8 w-8 text-emerald-300" />
            </div>
            <div>
              <p className="text-3xl font-extrabold text-emerald-300 leading-none">{rec.port.id}</p>
              <p className="mt-1 text-sm font-medium">{rec.port.station}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" />{rec.port.location}</p>
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
              </span>
              <span className="text-emerald-300 font-medium">Open now</span>
            </div>
            <span className="text-border">|</span>
            <span className="text-muted-foreground">Not reserved — first to plug in wins</span>
          </div>

          {/* Key details grid */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-secondary/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Charge</p>
              <p className="text-lg font-bold">~{rec.duration_minutes}<span className="text-xs font-normal text-muted-foreground">min</span></p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Start by</p>
              <p className="text-lg font-bold">{rec.latest_start_by}</p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3 text-center">
              <p className="text-xs text-muted-foreground">Reliability</p>
              <p className="text-lg font-bold">{rec.port.reliability != null ? Math.round(rec.port.reliability) : "—"}<span className="text-xs font-normal text-muted-foreground">%</span></p>
            </div>
          </div>

          {rec.meeting_note && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-primary">
              <CalendarClock className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{rec.meeting_note}</span>
            </div>
          )}

          {/* Primary CTA */}
          <Button className="mt-4 w-full" size="lg" onClick={() => onCheckIn(rec.port.id, rec.duration_minutes)}>
            <MapPin className="h-4 w-4" /> I'm heading to {rec.port.id}
          </Button>

          {/* Backup ports */}
          {rec.backups?.length > 0 && (
            <div className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">If {rec.port.id} is taken when you arrive:</p>
              <div className="space-y-1.5">
                {rec.backups.map((b, i) => (
                  <button key={b.id} onClick={() => onCheckIn(b.id, rec.duration_minutes)}
                    className="flex w-full items-center justify-between rounded-lg bg-secondary/40 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/70">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{i + 2}</span>
                      <span className="font-semibold text-foreground">{b.id}</span>
                      <span className="text-xs text-muted-foreground">{b.station}</span>
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {b.reliability != null && <span>{Math.round(b.reliability)}% reliable</span>}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-center text-xs text-muted-foreground">{rec.congestion_tip}</p>

          {onSteal && (
            <button onClick={() => onSteal(rec.port.id)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-1.5 text-[11px] text-muted-foreground/70 hover:text-muted-foreground">
              <Ghost className="h-3 w-3" /> Demo: someone else plugs into {rec.port.id} first
            </button>
          )}
        </CardContent>
      </Card>
    );
  }

  if (rec.mode === "join_line") {
    return (
      <Card className="border-amber-400/50">
        <CardContent className="p-5">
          <Badge variant="amber" className="gap-1"><Users className="h-3 w-3" /> All ports busy</Badge>

          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-400/15">
              <Users className="h-8 w-8 text-amber-300" />
            </div>
            <div>
              <p className="text-lg font-bold text-amber-200">Every port is occupied</p>
              <p className="text-xs text-muted-foreground">{rec.queue_length || 0} {rec.queue_length === 1 ? 'person' : 'people'} already in the handoff line</p>
            </div>
          </div>

          {/* Next likely free */}
          {rec.next_free && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3">
              <p className="text-xs text-amber-200/70 mb-1">Predicted next opening</p>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-200">{rec.next_free.id}</p>
                  <p className="text-xs text-muted-foreground">{rec.next_free.time}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-amber-300" />
                <div className="text-sm text-amber-200">
                  {rec.free_by_deadline || 0} port{rec.free_by_deadline === 1 ? '' : 's'} should free before <b>{rec.latest_start_by}</b>
                </div>
              </div>
            </div>
          )}

          <Button className="mt-4 w-full" size="lg" variant="amber" onClick={() => joinQueue(null)}>
            <Bell className="h-4 w-4" /> Notify me when a port frees
          </Button>

          <p className="mt-3 text-center text-xs text-muted-foreground">{rec.congestion_tip}</p>
        </CardContent>
      </Card>
    );
  }

  // past_deadline
  return (
    <Card className="border-red-500/50">
      <CardContent className="p-5">
        <Badge variant="red" className="gap-1"><AlertTriangle className="h-3 w-3" /> Past latest start</Badge>
        <p className="mt-3 text-sm">{rec.message}</p>
      </CardContent>
    </Card>
  );
}

function SimulateModal({ data, onClose }) {
  if (!data) return null;
  const shared = data.ports.filter((p) => p.shared_by > 1).length;
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="glass relative z-10 max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-bold">{data.count} colleagues requested at once</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Same 20% battery, same schedule, {data.open_ports} ports open.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-emerald-500/10 p-3">
            <p className="text-2xl font-bold text-emerald-300">{data.unique_first}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">unique ports first</p>
          </div>
          <div className="rounded-xl bg-amber-400/10 p-3">
            <p className="text-2xl font-bold text-amber-300">{data.count - data.unique_first}</p>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">share &amp; race (FCFS)</p>
          </div>
        </div>

        <p className="mb-1 text-xs text-muted-foreground">
          While ports last, everyone gets a <b className="text-foreground">different</b> one. Once drivers
          outnumber open ports, the rest are honestly pointed at the same ports — first to plug in wins:
        </p>
        <div className="mb-3 space-y-1">
          {data.ports.map((p) => (
            <div key={p.port} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-1.5 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                <Plug className="h-3.5 w-3.5" />{p.port}
              </span>
              <span className={cn("text-xs", p.shared_by > 1 ? "text-amber-300" : "text-muted-foreground")}>
                {p.shared_by > 1 ? `${p.shared_by} drivers → FCFS` : "1 driver"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No app-side reservation. {shared > 0
            ? `${shared} port(s) had more than one taker — the charger decides, first to plug in.`
            : "Enough ports for everyone this minute — all distinct."}
        </p>
        <Button variant="outline" className="mt-3 w-full" onClick={onClose}>Got it</Button>
      </motion.div>
    </motion.div>
  );
}

function TimeSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
    >
      {Array.from({ length: 27 }, (_, i) => 7 + i * 0.5).filter((h) => h <= 20).map((h) => (
        <option key={h} value={h}>{fmtMin(h * 60)}</option>
      ))}
    </select>
  );
}

export default function Recommend() {
  const {
    battery, setBattery, commute, setCommute, hasHomeCharger, minute,
    checkIn, pushToast, snapshot, refresh,
  } = useApp();
  const [rec, setRec] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [simData, setSimData] = useState(null);
  const [simming, setSimming] = useState(false);

  const addBlock = () => setBlocks((b) => [...b, { start: 10, end: 11 }]);
  const removeBlock = (i) => setBlocks((b) => b.filter((_, idx) => idx !== i));
  const updateBlock = (i, key, val) =>
    setBlocks((b) => b.map((blk, idx) => (idx === i ? { ...blk, [key]: Number(val) } : blk)));

  const blocksKey = JSON.stringify(blocks);
  const requestRec = useCallback(async () => {
    try {
      const r = await apiPost("/api/recommend", {
        battery_pct: battery, commute_miles: commute,
        has_home_charger: hasHomeCharger, current_minute: minute,
        calendar_blocks: JSON.parse(blocksKey),
      });
      setRec(r);
      return r;
    } catch { return null; }
  }, [battery, commute, hasHomeCharger, minute, blocksKey]);

  useEffect(() => { requestRec(); }, [requestRec]);

  const handleCheckIn = useCallback(async (portId, mins) => {
    const r = await checkIn(portId, mins);
    if (r && r.justTaken) {
      const next = await requestRec();
      if (next?.mode === "charge_now") {
        pushToast({ key: "rebook", variant: "default", icon: "zap",
          title: `Try ${next.port.id} instead`,
          body: "Your first pick was taken — here's the next-best open port.",
          duration: 6000 });
      }
    }
  }, [checkIn, requestRec, pushToast]);

  const handleSteal = useCallback(async (portId) => {
    await apiPost("/api/demo/steal", { port_id: portId, current_minute: minute }).catch(() => {});
    await requestRec();
    refresh();
  }, [minute, requestRec, refresh]);

  const handleSimulate = useCallback(async () => {
    setSimming(true);
    try {
      const r = await apiPost("/api/demo/simulate", {
        count: 10, battery_pct: 20, commute_miles: 40,
        has_home_charger: false, current_minute: minute,
      });
      setSimData(r);
      await requestRec();
      refresh();
    } catch { /* ignore */ }
    setSimming(false);
  }, [minute, requestRec, refresh]);

  const openNow = snapshot?.counts?.available;

  return (
    <div className="space-y-4">
      {/* Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" /> Your charge inputs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-2"><Battery className="h-4 w-4 text-accent" /> Battery</Label>
              <span className="text-lg font-bold tabular-nums text-accent">{battery}%</span>
            </div>
            <Slider value={battery} min={5} max={100} step={1} onChange={setBattery} color="accent" />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> One-way commute</Label>
              <span className="text-lg font-bold tabular-nums text-primary">{commute} mi</span>
            </div>
            <Slider value={commute} min={2} max={80} step={1} onChange={setCommute} />
          </div>
          {/* Optional meeting blocks */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" /> Meetings today <span className="text-xs font-normal text-muted-foreground">(optional)</span></Label>
              <Button size="sm" variant="outline" onClick={addBlock} className="h-8">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {blocks.length === 0 && (
                <p className="text-sm text-muted-foreground">No meetings — we'll nudge you to unplug the moment you're full.</p>
              )}
              {blocks.map((b, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-secondary/40 p-2">
                  <TimeSelect value={b.start} onChange={(v) => updateBlock(i, "start", v)} />
                  <span className="text-muted-foreground">→</span>
                  <TimeSelect value={b.end} onChange={(v) => updateBlock(i, "end", v)} />
                  <button onClick={() => removeBlock(i)} className="ml-auto text-muted-foreground hover:text-red-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <YourSession />

      {openNow != null && (
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-accent" />
          {openNow} port{openNow === 1 ? '' : 's'} open now — not reserved (FCFS).
        </div>
      )}

      {/* Recommendation */}
      <motion.div key={rec?.port?.id || rec?.mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <RecCard rec={rec} onCheckIn={handleCheckIn} onSteal={handleSteal} />
      </motion.div>

      <button onClick={handleSimulate} disabled={simming}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 py-2 text-[11px] text-muted-foreground/70 hover:text-muted-foreground disabled:opacity-50">
        <Users className="h-3 w-3" /> {simming ? "Simulating…" : "Demo: simulate 10 colleagues requesting at once"}
      </button>

      <AnimatePresence>
        {simData && <SimulateModal data={simData} onClose={() => setSimData(null)} />}
      </AnimatePresence>
    </div>
  );
}
