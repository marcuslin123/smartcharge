import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Zap, Clock, Ghost, CheckCircle2, AlertTriangle, X, Plug, Users, ArrowRight,
} from "lucide-react";
import { useApp } from "@/store";
import { Card, CardContent, Button, Badge, Slider } from "@/components/ui";
import { cn, fmtMin } from "@/lib/utils";

const STATUS = {
  available: { label: "Open", color: "text-emerald-200", ring: "border-emerald-400/70 bg-emerald-500/25", dot: "bg-emerald-400" },
  charging: { label: "Charging", color: "text-sky-200", ring: "border-sky-400/50 bg-sky-500/20", dot: "bg-sky-400" },
  charging_you: { label: "You", color: "text-accent", ring: "border-accent/70 bg-accent/25", dot: "bg-accent" },
  idle_you: { label: "You · full", color: "text-accent", ring: "border-accent/70 bg-accent/30", dot: "bg-accent" },
  idle_done: { label: "Full — idle", color: "text-amber-200", ring: "border-amber-400/70 bg-amber-500/25", dot: "bg-amber-400" },
  incoming: { label: "Watching", color: "text-violet-200", ring: "border-dashed border-violet-400/70 bg-violet-500/15", dot: "bg-violet-400" },
  offline: { label: "Offline", color: "text-muted-foreground", ring: "border-border bg-secondary/30 opacity-60", dot: "bg-muted-foreground" },
};

function Stat({ n, label, cls }) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-secondary/40 px-2 py-2">
      <span className={cn("text-xl font-bold tabular-nums", cls)}>{n}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function PortTile({ p, onClick }) {
  const s = STATUS[p.status] || STATUS.offline;
  const isYou = p.status === "charging_you" || p.status === "idle_you";
  return (
    <motion.button
      layout
      onClick={() => onClick(p)}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center rounded-xl border p-1 text-center transition-colors",
        s.ring, isYou && "glow"
      )}
    >
      {p.status === "available" && (
        <span className="absolute right-1 top-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
      )}
      <span className={cn("text-[11px] font-bold leading-none", s.color)}>{p.id}</span>
      {p.status === "available" && <Plug className="mt-1 h-3.5 w-3.5 text-emerald-300" />}
      {(p.status === "charging" || p.status === "charging_you") && (
        <span className="mt-0.5 text-[9px] text-muted-foreground">{Math.round(p.free_in)}m</span>
      )}
      {p.status === "idle_done" && (
        <span className="mt-0.5 text-[9px] text-amber-300">+{Math.round(p.over_by)}m</span>
      )}
      {p.status === "idle_you" && <span className="mt-0.5 text-[9px] text-accent">full</span>}
      {p.status === "incoming" && <span className="mt-0.5 text-[9px] text-violet-300">watching</span>}
      {p.status === "offline" && <Ghost className="mt-1 h-3.5 w-3.5 text-muted-foreground" />}
    </motion.button>
  );
}

function Cluster({ name, ports, onClick }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{name}</h3>
          <Badge variant="muted">{ports.filter((p) => p.status === "available").length} open · {ports.length} ports</Badge>
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          <AnimatePresence>
            {ports.map((p) => <PortTile key={p.id} p={p} onClick={onClick} />)}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
}

function PortDrawer({ p, onClose }) {
  const { minute, startCharging, checkOut, yourSession } = useApp();
  const [mins, setMins] = useState(90);
  if (!p) return null;
  const s = STATUS[p.status] || STATUS.offline;
  const isYours = yourSession && yourSession.port === p.id;
  const watchedByOther = p.status === "incoming" && !isYours;

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="glass relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
              <h3 className="text-xl font-bold">{p.id}</h3>
              <Badge variant="muted">{s.label}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{p.station} · {p.location}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="mb-4 flex items-center gap-2 text-sm">
          <Badge variant={p.reliability >= 90 ? "default" : p.reliability >= 70 ? "amber" : "red"}>
            {Math.round(p.reliability)}% reliable
          </Badge>
        </div>

        {(p.status === "available" || watchedByOther) && (
          <div>
            {watchedByOther && (
              <p className="mb-2 rounded-lg bg-violet-500/10 px-3 py-2 text-xs text-violet-200">
                A colleague is planning to use this — it's still open, first to plug in wins (FCFS).
              </p>
            )}
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-muted-foreground">How long do you need?</span>
              <span className="font-semibold">{mins} min · done {fmtMin(minute + mins)}</span>
            </div>
            <Slider value={mins} min={15} max={240} step={15} onChange={setMins} color="accent" />
            <Button className="mt-4 w-full" onClick={() => { startCharging(p.id, mins); onClose(); }}>
              <Plug className="h-4 w-4" /> I'm plugging in here
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Only tap this when you're physically at the charger. It updates the live map for everyone.
            </p>
          </div>
        )}

        {isYours && yourSession.phase === "incoming" && (
          <div>
            <p className="mb-3 text-sm">You're planning to use this. Tap once you've physically plugged in — it's not saved for you.</p>
            <Button variant="accent" className="w-full" onClick={() => { startCharging(p.id, yourSession.charge_minutes); onClose(); }}>
              <Plug className="h-4 w-4" /> I've plugged in
            </Button>
          </div>
        )}

        {isYours && yourSession.phase !== "incoming" && (
          <div>
            <p className="mb-3 text-sm">This is your session. Please check out when you unplug so the next person can charge.</p>
            <Button variant="accent" className="w-full" onClick={() => { checkOut(); onClose(); }}>
              <CheckCircle2 className="h-4 w-4" /> Check out (I've unplugged)
            </Button>
          </div>
        )}

        {p.status === "charging" && !isYours && (
          <div className="rounded-xl bg-secondary/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-sky-300"><Zap className="h-4 w-4" /> In use</div>
            <p className="mt-1 text-muted-foreground">Predicted free ~<b className="text-foreground">{fmtMin(p.predicted_free)}</b> (about {Math.round(p.free_in)} min).</p>
          </div>
        )}

        {p.status === "idle_done" && (
          <div className="rounded-xl bg-amber-400/10 p-3 text-sm">
            <div className="flex items-center gap-2 text-amber-300"><AlertTriangle className="h-4 w-4" /> Fully charged but still plugged in</div>
            <p className="mt-1 text-muted-foreground">Done ~{Math.round(p.over_by)} min ago. A "move your car" nudge has been sent to the driver.</p>
          </div>
        )}

        {p.status === "offline" && (
          <div className="rounded-xl bg-secondary/50 p-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Ghost className="h-4 w-4" /> Excluded from recommendations</div>
            <p className="mt-1 text-muted-foreground">{p.offline_reason}</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function HandoffCard() {
  const { snapshot, queue, joinQueue, leaveQueue } = useApp();
  const inLine = queue?.your_position != null;
  const assigned = queue?.your_assignment;
  const anyOpen = (snapshot?.counts?.available ?? 0) > 0;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Handoff line</h3>
          </div>
          <Badge variant="muted">{snapshot?.queue_length ?? 0} waiting</Badge>
        </div>
        {assigned ? (
          <div className="mt-3 rounded-xl bg-accent/15 p-3 text-sm">
            <b className="text-accent">{assigned.port} just opened</b> — you're next in line, head over. It's not reserved, so first to plug in wins.
          </div>
        ) : inLine ? (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">You're <b className="text-foreground">#{queue.your_position}</b> in line. We'll ping you.</p>
            <Button size="sm" variant="outline" onClick={leaveQueue}>Leave</Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {anyOpen ? "Chargers are open — grab one on the map." : "All full right now. Join the line instead of circling the lot."}
            </p>
            <Button size="sm" disabled={anyOpen} onClick={() => joinQueue(null)}>Join line</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function LiveMap() {
  const { snapshot } = useApp();
  const [sel, setSel] = useState(null);

  const clusters = useMemo(() => {
    const ports = snapshot?.ports || [];
    return {
      beach: ports.filter((p) => p.cluster === "beach"),
      garage: ports.filter((p) => p.cluster === "garage"),
    };
  }, [snapshot]);

  if (!snapshot) return <div className="py-20 text-center text-muted-foreground">Connecting to live feed…</div>;
  const c = snapshot.counts;
  const selPort = sel ? (snapshot.ports.find((p) => p.id === sel.id) || sel) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-2">
            <Stat n={c.available} label="Open" cls="text-emerald-300" />
            <Stat n={c.charging} label="Charging" cls="text-sky-300" />
            <Stat n={c.idle_done} label="Idle-full" cls="text-amber-300" />
            <Stat n={c.offline} label="Offline" cls="text-muted-foreground" />
          </div>
          {c.idle_done > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-400/10 p-2.5 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {c.idle_done} fully-charged {c.idle_done === 1 ? "car is" : "cars are"} still plugged in — freeing them is the fastest way to open chargers.
            </div>
          )}
        </CardContent>
      </Card>

      <HandoffCard />

      {snapshot.upcoming_free?.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-primary" /><h3 className="font-semibold">Opening soon</h3></div>
            <div className="flex flex-wrap gap-2">
              {snapshot.upcoming_free.map((u) => (
                <Badge key={u.id} variant="muted" className="gap-1">
                  <b className="text-foreground">{u.id}</b> <ArrowRight className="h-3 w-3" /> {u.time} ({u.in_min}m)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Cluster name="Building E Lot (Outside)" ports={clusters.beach} onClick={setSel} />
      <Cluster name="Main Parking Garage" ports={clusters.garage} onClick={setSel} />

      <p className="px-1 text-center text-xs text-muted-foreground">
        26 real ChargePoint ports (live). Other campus brands (106 ports total) integrate when their feeds come online.
      </p>

      <AnimatePresence>
        {selPort && <PortDrawer p={selPort} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}
