import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home as HomeIcon, Zap, Bell, User, Clock as ClockIcon,
} from "lucide-react";
import { useApp } from "@/store";
import { cn, fmtHour } from "@/lib/utils";
import Toaster from "@/components/Toaster";
import Home from "@/screens/Home";
import Recommend from "@/screens/Recommend";
import Alerts from "@/screens/Alerts";
import Profile from "@/screens/Profile";

const TABS = [
  { id: "home", label: "Home", icon: HomeIcon, C: Home },
  { id: "recommend", label: "Recommend", icon: Zap, C: Recommend },
  { id: "alerts", label: "Alerts", icon: Bell, C: Alerts },
  { id: "profile", label: "Profile", icon: User, C: Profile },
];

function Clock() {
  const { snapshot, minute, isNow, resetToNow } = useApp();
  return (
    <button
      onClick={resetToNow}
      title={isNow ? "Showing current time" : "Tap to jump back to now"}
      className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1.5"
    >
      {isNow ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
      ) : (
        <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className="text-sm font-semibold tabular-nums tracking-tight leading-none">
        {snapshot?.time || fmtHour(minute / 60)}
      </span>
    </button>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const Active = TABS.find((t) => t.id === tab).C;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <Toaster />

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-background/70 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent glow">
            <Zap className="h-5 w-5 text-white" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">SmartCharge</h1>
            <p className="text-[11px] text-muted-foreground">Juno Beach</p>
          </div>
        </div>
        <Clock />
      </header>

      <main className="flex-1 px-4 pb-28 pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <Active goTo={setTab} />
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-4 pb-4">
        <div className="glass flex items-center justify-around rounded-2xl p-1.5 shadow-2xl">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.div
                    layoutId="navpill"
                    className="absolute inset-0 rounded-xl bg-primary/10"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative h-5 w-5" />
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
