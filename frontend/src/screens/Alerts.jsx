import React from "react";
import { motion } from "framer-motion";
import {
  Bell, Clock, TriangleAlert, TrendingUp, Ghost, Users, Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from "@/components/ui";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";

const ICONS = {
  "alert-triangle": TriangleAlert, clock: Clock, zap: Zap,
  ghost: Ghost, "trending-up": TrendingUp, users: Users,
};

const PRIORITY = { high: "red", normal: "default", low: "accent" };

const SEGMENT_INFO = [
  ["high_need", "Battery < 30%, or long commute + low charge. Gets the best open port + backups. No priority boost — same FCFS rules for all."],
  ["flexible", "Plenty of charge, short commute. Gently nudged to leave peak ports for colleagues who need them now."],
  ["standard", "Everyone else. Balanced, real-time recommendation."],
  ["home_charge_preferred", "Has a home charger and enough to get home. Routed to charge at home tonight."],
  ["no_charge_needed", "Enough for the round trip. \"Save the charger for someone who needs it more!\""],
];

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
            <Bell className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Notify me when a port frees</h3>
          </div>
          <Badge variant="muted">{snapshot?.queue_length ?? 0} waiting</Badge>
        </div>
        {assigned ? (
          <div className="mt-3 rounded-xl bg-accent/15 p-3 text-sm">
            <b className="text-accent">{assigned.port} just opened</b> — you're up next, head over now. It's not reserved, so first to plug in wins (FCFS).
          </div>
        ) : inLine ? (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">You're <b className="text-foreground">#{queue.your_position}</b> to be notified. We'll ping you the moment a charger frees — it's a heads-up, not a reservation.</p>
            <Button size="sm" variant="outline" onClick={leaveQueue}>Stop</Button>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {anyOpen ? "Chargers are open — get a recommendation to grab one." : "All full right now. Get pinged when one opens instead of circling the lot."}
            </p>
            <Button size="sm" disabled={anyOpen} onClick={() => joinQueue(null)}>Notify me</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Alerts() {
  const { notifications } = useApp();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Bell className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">Live nudges</h2>
      </div>
      <p className="px-1 text-sm text-muted-foreground">
        Real-time, segmented, anti-spam — driven by what's actually happening in the garage right now.
      </p>

      <HandoffCard />

      {notifications.map((n, i) => {
        const Icon = ICONS[n.icon] || Bell;
        return (
          <motion.div
            key={n.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card>
              <CardContent className="flex items-start gap-3 p-4">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  n.priority === "high" ? "bg-red-500/15 text-red-300"
                    : n.priority === "low" ? "bg-accent/15 text-accent"
                    : "bg-primary/15 text-primary"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold leading-tight">{n.title}</p>
                    <Badge variant={PRIORITY[n.priority]} className="shrink-0 capitalize">{n.priority}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  {n.segment !== "all" && (
                    <Badge variant="muted" className="mt-2 text-[10px]">for: {n.segment}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">How segments work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {SEGMENT_INFO.map(([seg, desc]) => (
            <div key={seg} className="rounded-xl bg-secondary/40 p-3">
              <p className="text-sm font-semibold text-primary">{seg}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
          <p className="px-1 pt-1 text-xs text-muted-foreground">
            Home-charger status never grants priority — it only informs messaging. First come, first served at the physical charger; the app recommends and shows interest, but never reserves a port.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
