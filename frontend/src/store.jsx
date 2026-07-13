import React, {
  createContext, useContext, useState, useEffect, useCallback, useRef,
} from "react";
import { apiGet, apiPost, fmtMin } from "@/lib/utils";

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const DAY_MIN = 6 * 60;
const DAY_MAX = 19 * 60;
let tid = 0;

function nowMinute() {
  const d = new Date();
  return Math.max(DAY_MIN, Math.min(DAY_MAX, d.getHours() * 60 + d.getMinutes()));
}

export function AppProvider({ children }) {
  // Static clock: defaults to the actual current time. Users scrub it themselves
  // to preview availability at other times — it does not auto-advance.
  const [minute, setMinuteRaw] = useState(nowMinute);

  const [battery, setBattery] = useState(28);
  const [commute, setCommute] = useState(32);
  const [hasHomeCharger, setHasHomeCharger] = useState(true);

  const [snapshot, setSnapshot] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [yourSession, setYourSession] = useState(null);
  const [queue, setQueue] = useState({ your_position: null, your_assignment: null, length: 0 });

  const [toasts, setToasts] = useState([]);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const pushToast = useCallback((toast) => {
    const id = ++tid;
    setToasts((t) => [...t.filter((x) => x.key !== toast.key), { id, ...toast }]);
    if (!toast.sticky) setTimeout(() => dismissToast(id), toast.duration || 6000);
  }, [dismissToast]);

  const setMinute = useCallback((m) => {
    setMinuteRaw(Math.max(DAY_MIN, Math.min(DAY_MAX, Math.round(m))));
  }, []);

  const resetToNow = useCallback(() => setMinuteRaw(nowMinute()), []);

  // Poll live snapshot + notifications + queue whenever the clock moves
  const notifiedFull = useRef(false);
  const notifiedSoon = useRef(false);
  const lastAssign = useRef(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiGet(`/api/live?minute=${minute}`),
      apiGet(`/api/notifications?minute=${minute}`),
      apiGet(`/api/queue/status?user=you&minute=${minute}`),
    ]).then(([snap, notes, q]) => {
      if (cancelled) return;
      setSnapshot(snap);
      setNotifications(notes);
      setQueue(q);

      // How many colleagues are looking to charge right now (adds urgency).
      const looking = (snap.counts?.incoming || 0) + (q.length || 0);
      const lookMsg = looking > 0
        ? ` ${looking} colleague${looking === 1 ? " is" : "s are"} looking to charge right now.`
        : "";

      // Proactive "wrap up soon" nudge ~10 min before you have enough to get home
      const charging = snap.ports.find((p) => p.status === "charging_you");
      if (charging && charging.predicted_full != null) {
        const left = charging.predicted_full - minute;
        if (left > 0 && left <= 10 && !notifiedSoon.current) {
          notifiedSoon.current = true;
          pushToast({
            key: "soon", variant: "default", icon: "clock",
            title: `Almost charged — ~${left} min left`,
            body: `In ~${left} min you'll have enough to get home. Plan to move ${charging.id} so a colleague can charge.${lookMsg}`,
            duration: 9000,
          });
        }
        if (left > 10) notifiedSoon.current = false;
      }

      // Your-session "you're full, move your vehicle" nudge
      const you = snap.ports.find((p) => p.status === "idle_you");
      if (you && !notifiedFull.current) {
        notifiedFull.current = true;
        pushToast({
          key: "full", variant: "accent", icon: "bell",
          title: "You're fully charged ⚡",
          body: `Please move your vehicle from ${you.id} now so a colleague can charge.${lookMsg || " You free a port by leaving."}`,
          duration: 9000,
        });
      }
      if (!you) notifiedFull.current = false;

      // Handoff notification (not a reservation — first to plug in wins)
      const a = q.your_assignment;
      if (a && a.port !== lastAssign.current) {
        lastAssign.current = a.port;
        pushToast({
          key: "assign", variant: "default", icon: "zap",
          title: "A charger just opened ⚡",
          body: `${a.port} freed up and you're next in line — head over. It's not reserved, so first to plug in gets it.`,
          duration: 12000,
        });
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [minute, refreshKey, pushToast]);

  // Actions
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // "On my way" — mark the port as heading-here (visibility only, not a hold).
  const checkIn = useCallback(async (portId, chargeMinutes) => {
    try {
      const r = await apiPost("/api/checkin", {
        port_id: portId, current_minute: minute, charge_minutes: chargeMinutes, user: "you",
      });
      setYourSession({ port: portId, phase: "incoming", charge_minutes: chargeMinutes, clears_by: r.clears_by });
      pushToast({ key: "checkin", variant: "default", icon: "check",
        title: `Watching ${portId}`,
        body: `Others can see you're planning to use it — it's not saved for you, so head over now. Tap "I've plugged in" once you're connected.`,
        duration: 6000 });
      setRefreshKey((k) => k + 1);
      return r;
    } catch (e) {
      const taken = e.detail?.error === "just_taken";
      pushToast({
        key: "err", variant: "amber", icon: "ghost",
        title: taken ? `${portId} was just taken` : "Couldn't check in",
        body: taken ? "Someone plugged in first (FCFS) — pulling up your next-best open port…"
                    : (e.detail?.message || "Please pick another port."),
        duration: 5000,
      });
      setRefreshKey((k) => k + 1);
      return { ok: false, justTaken: taken };
    }
  }, [minute, pushToast]);

  // "I've plugged in" — begin the actual session.
  const startCharging = useCallback(async (portId, chargeMinutes) => {
    try {
      const r = await apiPost("/api/start-charging", {
        port_id: portId, current_minute: minute, charge_minutes: chargeMinutes, user: "you",
      });
      setYourSession({ port: portId, phase: "charging", checkout_by: r.checkout_by, full_minute: r.full_minute });
      notifiedFull.current = false;
      notifiedSoon.current = false;
      pushToast({ key: "checkin", variant: "accent", icon: "check",
        title: `Charging at ${portId}`,
        body: `We'll nudge you ~10 min before you have enough to get home, and remind you to unplug by ${r.checkout_by}.`,
        duration: 6000 });
      setRefreshKey((k) => k + 1);
      return r;
    } catch (e) {
      const taken = e.detail?.error === "just_taken";
      pushToast({
        key: "err", variant: "amber", icon: "ghost",
        title: taken ? `${portId} was just taken` : "Couldn't start",
        body: taken ? "Someone plugged in first (FCFS) — pulling up your next-best open port…"
                    : (e.detail?.message || "Please pick another port."),
        duration: 5000,
      });
      setRefreshKey((k) => k + 1);
      return { ok: false, justTaken: taken };
    }
  }, [minute, pushToast]);

  const checkOut = useCallback(async () => {
    if (!yourSession) return;
    const r = await apiPost("/api/checkout", { port_id: yourSession.port, current_minute: minute });
    setYourSession(null);
    notifiedFull.current = false;
    let body = "Thanks for freeing the charger!";
    if (r.handoff) body = `${r.handoff.port} just freed — we notified the next person waiting. Nice, that's how we keep it flowing.`;
    pushToast({ key: "checkout", variant: "accent", icon: "check", title: "Checked out", body, duration: 7000 });
    setRefreshKey((k) => k + 1);
    return r;
  }, [minute, yourSession, pushToast]);

  const joinQueue = useCallback(async (cluster) => {
    const r = await apiPost("/api/queue/join", { user: "you", cluster, current_minute: minute });
    pushToast({ key: "queue", variant: "default", icon: "clock",
      title: `You're #${r.position} to be notified`,
      body: "We'll ping you the moment a charger frees — a heads-up, not a reservation. No circling the lot.", duration: 6000 });
    setRefreshKey((k) => k + 1);
    return r;
  }, [minute, pushToast]);

  const leaveQueue = useCallback(async () => {
    await apiPost("/api/queue/leave", { user: "you" });
    lastAssign.current = null;
    setRefreshKey((k) => k + 1);
  }, []);

  const resetSim = useCallback(async () => {
    await apiPost("/api/reset", {});
    setYourSession(null);
    lastAssign.current = null;
    notifiedFull.current = false;
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <Ctx.Provider value={{
      minute, setMinute, resetToNow,
      battery, setBattery, commute, setCommute, hasHomeCharger, setHasHomeCharger,
      snapshot, notifications, yourSession, queue,
      toasts, pushToast, dismissToast,
      checkIn, startCharging, checkOut, joinQueue, leaveQueue, resetSim, refresh,
      fmtMin,
    }}>
      {children}
    </Ctx.Provider>
  );
}
