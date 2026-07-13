import React, { useEffect, useState } from "react";
import { User, Car, MapPin, Home, Clock, Leaf, BadgeCheck, TrendingUp, CalendarDays, BatteryCharging } from "lucide-react";
import { apiGet, fmtMin } from "@/lib/utils";
import { Card, CardContent, Badge, Switch } from "@/components/ui";
import { useApp } from "@/store";

const USER = "159231V";

// Illustrative profile details (no PII in the dataset — dummy per the PRD).
const VEHICLE = "Ford Mustang Mach-E · 2024";
const ADDRESS = "1180 Ocean Dr, Juno Beach, FL 33408";

function Row({ icon: Icon, label, value, children }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {value && <p className="truncate font-semibold">{value}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Profile() {
  const { hasHomeCharger, setHasHomeCharger } = useApp();
  const [p, setP] = useState(null);
  useEffect(() => { apiGet(`/api/user/${USER}/pattern`).then(setP).catch(() => {}); }, []);

  return (
    <div className="space-y-4">
      {/* Identity */}
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent glow">
            <User className="h-8 w-8 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Alex Rivera</h2>
            <p className="text-sm text-muted-foreground">Driver {USER} · FPL Juno Beach</p>
            <Badge variant="accent" className="mt-1"><BadgeCheck className="h-3 w-3" /> Enrolled</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Basic info — row format */}
      <Card>
        <CardContent className="divide-y divide-border/60 px-5 py-1">
          <Row icon={Car} label="Vehicle" value={VEHICLE} />
          <Row icon={MapPin} label="Home address" value={ADDRESS} />
          <Row icon={Home} label="Home charger">
            <Switch checked={hasHomeCharger} onChange={setHasHomeCharger} />
          </Row>
        </CardContent>
      </Card>

      {/* Your typical pattern — lightweight, from real session history; informs the recommendation */}
      {p && (
        <Card>
          <CardContent className="px-5 py-1">
            <div className="flex items-center gap-2 py-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              <p className="font-semibold">Your typical pattern</p>
              <Badge variant={p.is_overnight ? "accent" : "muted"} className="ml-auto text-[10px]">
                {p.is_overnight ? "Overnight / off-peak" : "Daytime"}
              </Badge>
            </div>
            <div className="divide-y divide-border/60">
              {p.typical_days?.length > 0 && (
                <Row icon={CalendarDays} label="Usual days" value={p.typical_days.map((d) => d.slice(0, 3)).join(" · ")} />
              )}
              <Row icon={Clock} label="Usual plug-in time" value={fmtMin(p.typical_arrival_hour * 60)} />
              <Row icon={MapPin} label="Favorite station" value={p.favorite_station.replace("JUNO ", "")} />
              <Row icon={BatteryCharging} label="Avg session" value={`~${p.avg_charge_minutes} min charging · ${p.avg_energy_kwh} kWh`} />
            </div>
            <p className="px-1 pb-3 pt-1 text-[11px] text-muted-foreground">
              We use this to pre-fill your recommendation and tailor nudges — it never grants priority (FCFS for all).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Overnight-charger insight (kept — it's the honest, data-true framing) */}
      {p?.is_overnight && (
        <Card className="border-emerald-400/40">
          <CardContent className="flex items-start gap-3 p-4">
            <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            <p className="text-sm text-muted-foreground">
              You almost always plug in around <b className="text-foreground">{fmtMin(p.typical_arrival_hour * 60)}</b> —
              fully <b className="text-emerald-300">off-peak</b>. You're a model charger: charging overnight avoids the
              8 AM–4 PM crunch entirely and leaves daytime ports free for colleagues. No nudges needed.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
