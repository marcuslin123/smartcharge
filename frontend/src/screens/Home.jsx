import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, XAxis, Tooltip, ReferenceArea } from "recharts";
import {
  Zap, ArrowRight, Gauge, Ghost,
} from "lucide-react";
import { Card, CardContent, Button, Slider } from "@/components/ui";
import { useApp } from "@/store";
import { apiGet, fmtMin } from "@/lib/utils";

// Live telemetry exists for the 26 ChargePoint ports; the campus has 106 ports
// across all brands. Per the PRD we scale live ChargePoint availability to the
// full campus proportionally until the other brands' feeds come online.
const CP_PORTS = 26;
const CAMPUS_PORTS = 106;

export default function Home({ goTo }) {
  const { snapshot, minute, setMinute, isNow } = useApp();
  const [curve, setCurve] = useState([]);

  useEffect(() => {
    apiGet("/api/insights").then((d) => {
      const rows = Object.entries(d.concurrency_by_hour)
        .map(([h, v]) => ({
          hour: Number(h),
          open: Math.round(Math.max(0, CP_PORTS - v) * (CAMPUS_PORTS / CP_PORTS)),
        }))
        .filter((r) => r.hour >= 6 && r.hour <= 19)
        .sort((a, b) => a.hour - b.hour);
      setCurve(rows);
    }).catch(() => {});
  }, []);

  const c = snapshot?.counts;
  const operational = c?.operational ?? CP_PORTS;
  const scale = operational ? CAMPUS_PORTS / operational : 0;
  const open = c ? Math.round(c.available * scale) : 0;
  const charging = c ? Math.round(c.charging * scale) : 0;
  const idleDone = c ? Math.round(c.idle_done * scale) : 0;
  const availPct = c && operational ? Math.round((c.available / operational) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Hero live availability */}
      <Card className="overflow-hidden">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Open chargers right now</p>
              <div className="flex items-baseline gap-2">
                <motion.span
                  key={open}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-5xl font-bold tabular-nums text-primary"
                >
                  {c ? open : "—"}
                </motion.span>
                <span className="text-lg text-muted-foreground">/ {CAMPUS_PORTS} campus ports</span>
              </div>
            </div>
          </div>

          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{availPct}% free</span>
            <span>{charging} charging · {idleDone} idle-full</span>
          </div>
          <div className="h-4 w-full overflow-hidden rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-accent to-primary"
              animate={{ width: `${availPct}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
          {(c?.offline ?? 0) > 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Ghost className="h-3.5 w-3.5 text-amber-300" />
              {c.offline} ghost charger{c.offline === 1 ? "" : "s"} excluded
            </p>
          )}
        </CardContent>
      </Card>

      {/* Availability by time */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-1 flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            <span className="font-semibold">Open chargers by time</span>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            <b className="text-primary tabular-nums">{c ? open : "—"} open</b> across campus at{" "}
            <b className="text-foreground">{fmtMin(minute)}</b>{isNow ? " (now)" : ""}. Drag to check another time.
          </p>

          <div className="mb-3 h-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curve} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="avail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <ReferenceArea x1={8} x2={16} fill="hsl(45 90% 55%)" fillOpacity={0.08} />
                <XAxis dataKey="hour" hide />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                  labelFormatter={(h) => fmtMin(h * 60)}
                  formatter={(v) => [`${v} open`, "Ports"]}
                />
                <Area type="monotone" dataKey="open" stroke="hsl(var(--accent))" strokeWidth={2} fill="url(#avail)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <Slider value={minute} min={6 * 60} max={19 * 60} step={5} onChange={setMinute} />
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>6 AM</span>
            <span className="text-amber-300">8 AM–4 PM peak</span>
            <span>7 PM</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            The whole app reflects the time you pick here — your recommendation and alerts.
          </p>
        </CardContent>
      </Card>

      {/* CTA */}
      <Button size="lg" className="w-full" onClick={() => goTo("recommend")}>
        <Zap className="h-5 w-5" fill="currentColor" />
        Get recommendation
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
