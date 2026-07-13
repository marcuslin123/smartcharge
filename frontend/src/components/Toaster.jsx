import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Check, X, Zap, Ghost, Clock } from "lucide-react";
import { useApp } from "@/store";
import { cn } from "@/lib/utils";

const icons = { bell: Bell, check: Check, zap: Zap, ghost: Ghost, clock: Clock };

export default function Toaster() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.icon] || Bell;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.96 }}
              className={cn(
                "pointer-events-auto glass w-full max-w-md rounded-2xl p-4 shadow-2xl",
                t.variant === "accent" ? "border-accent/40 glow"
                  : t.variant === "amber" ? "border-amber-400/40" : "border-primary/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  t.variant === "accent" ? "bg-accent/20 text-accent"
                    : t.variant === "amber" ? "bg-amber-400/20 text-amber-300" : "bg-primary/20 text-primary"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold leading-tight">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-muted-foreground">{t.body}</p>}
                </div>
                <button onClick={() => dismissToast(t.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
