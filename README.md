# SmartCharge v2 ⚡ — Live availability, FCFS, and turnover

A rethink of SmartCharge for the FPL Juno Beach campus, built on the **real
ChargePoint session data**. Where v1 answered *"when should I charge?"*, v2
answers the question the data says actually matters: **"where do I plug in right
now, fairly, without circling the lot — and how do we keep chargers flowing so
everyone gets a turn?"**

---

## Why v2 exists (what the real data showed)
Analysis of the 4,758 real ChargePoint sessions (Jan–Jun 2026, 13 stations / 26
ports) reframed the problem:

- **The garage is saturated all workday.** ~23–25 of 26 ports are in use *every
  hour* from 8 AM–4 PM (~93% utilization). There is no real "off-peak" window to
  send people to during the workday, so v1's "charge at 2 PM" advice is a false
  lever.
- **Cars camp.** Median session is **6.6 h** but only ~5.2 h is actual charging;
  cars sit **idle a mean 97 min** after they finish. Reclaiming half that idle
  frees **~20 port-hours/day** — more capacity than any timing nudge.
  **Turnover beats timing.**
- **A charger is statistically dead.** JUNO BEACH 06 has a **53% zero-kWh** rate —
  auto-flagged as a ghost, corroborated by work orders, so it's never recommended.
- **Evenings actually empty out.** Session end-times peak ~4 PM and taper to
  near-empty by 7 PM, so availability rises sharply after 5 PM (see "Open chargers
  by time" on Home).

---

## Core principle: pure FCFS, the app never reserves
The single most important design decision. **First person to physically plug in
wins.** The app *recommends* and *shows visibility*, but it never holds, claims,
or reserves a port. This is deliberate and evolved over several iterations:

- We first tried **soft-holds** (recommend a port → hold it ~5 min so two people
  aren't sent to the same charger). We removed them: with far more drivers than
  chargers it's *inevitable and correct* that multiple people are pointed at the
  same open port — a remote "hold" from someone's desk would defeat FCFS for the
  driver physically standing at the charger.
- So recommendations now **spread people across open ports when supply allows**
  (a staleness tiebreaker sends the next person to a different port), but once
  drivers outnumber open ports the **same port is honestly recommended to more
  than one person** — and we say so (see Contention below).

---

## What changed from v1 (and why)
v2 keeps v1's **layout** (mobile single-column, bottom tab bar — Home · Recommend
· Alerts · Profile) and color palette, but changes the substance:

- **Right lever.** v1's premise was "charge off-peak" (shift people to 2–4 PM).
  The real data shows the garage is ~93% full *every* workday hour, so there is
  no off-peak window — that advice was a false lever. v2 targets **turnover +
  live availability** instead (the bottleneck the data actually revealed).
- **A concrete answer, not a chart to interpret.** v1 gave dashboards and timing
  guidance and left you to figure out where to go. v2 gives one decision:
  *"plug into G05-A."*
- **Handles contention (the real failure mode).** v1 had no concept of two people
  wanting the same charger. v2 adds pure-FCFS spread, **contention awareness**
  ("X others are also looking"), a **notify-me-when-free** queue with no-show
  pass-through, and **urgency turnover nudges** ("move your car, Z waiting").
- **Real data, real-time-first.** v1 ran on synthetic assumptions and static
  recommendations. v2 is built on the actual 4,758-session ChargePoint dataset,
  runs a live availability engine, and does data-driven **ghost detection**
  (JUNO BEACH 06 = 53% zero-kWh → auto-excluded). The engine is structured so a
  live telemetry feed drops in without changing the API.
- **Honest about the data.** v2 corrects v1 mistakes — e.g. it recognizes user
  159231V as an **overnight/off-peak charger** (85 of 114 sessions at 10 PM)
  rather than idle-shaming them, and it flags the Blink file as *not* Juno Beach
  so it isn't used to fake occupancy.
- **Visibility, not reservations.** v1 had no check-in. v2 added one, then
  deliberately reshaped it into a **visibility-only, two-step** signal
  (Watching → I've plugged in) after we confirmed any remote hold would break
  FCFS for the driver physically at the charger.

### Iteration history within v2 (design decisions)
- **Soft-holds → removed.** Early v2 held a recommended port ~5 min; dropped in
  favor of pure FCFS (see "Core principle").
- **Check-in reframed** from "heading here" (implied claim) to "planning to use /
  watching" (interest only), so people arrive urgent and nobody feels entitled.
- **Live garage map demoted then removed** from the employee flow — it covered
  only 26 of 106 ports and pushed the decision back onto the employee.
- **UI polish** per feedback: static clock (defaults to now, scrub to preview),
  "Open chargers by time" slider, row-format Profile, campus count of 106 (scaled
  from 26 live ChargePoint ports), removed clutter (turnover card, peak badge,
  segment badges), sleeker header/clock.
- **Occupancy realism fix.** The live sim originally kept cars plugged in until
  ~7 PM; departures now sample the **real weekday end-time distribution** so the
  evening empties out like the historical curve.

---

## What the app does (current)

### Home
- **Open chargers right now** — live count out of the **106-port campus**. Live
  telemetry only exists for the 26 ChargePoint ports, so per the PRD we scale
  ChargePoint availability proportionally to 106 until the other brands' feeds
  come online.
- **Open chargers by time** — drag the slider to see availability at any time.
  The mini-curve is the **real weekday concurrency** from the ChargePoint data
  (packed 8 AM–4 PM, emptying through the evening); the whole app reflects the
  time you pick.
- **X ghost chargers excluded** — one-line note; broken/dead ports are routed
  around.
- **Get recommendation** CTA.

> The live garage map was intentionally **removed from the employee flow**: it
> only covered 26 of 106 ports and put the "where do I go?" decision back on the
> employee. The recommendation is the single, clear answer instead. (`LiveMap.jsx`
> remains in the repo as a demo-only artifact.)

### Recommend (the hero)
- **One clear answer** — "head to G05-A" — grounded in live availability, keeping
  v1's equity rules (segments, home-charger routing, 5:30 PM finish, latest-start
  deadline).
- **Home-charger logic** — only skips/reduces charging when you *actually* have
  the range: enough for a round trip → don't charge; enough to get home → charge
  at home tonight; **not enough to get home → it still recommends charging now**
  (just the smaller amount, since the home charger tops up the rest). A home
  charger never blocks a needed charge and never grants priority.
- **Visibility check-in (two steps, not a reservation):**
  1. **"Planning to use / Watching"** — marks the port with a violet "Watching"
     badge so colleagues see interest. It does **not** save the port; a walk-up
     who plugs in first still wins. Auto-clears after 15 min if you don't show.
  2. **"I've plugged in"** — only now does it become your charging session with a
     timer + nudges. The map never claims a port is occupied when it isn't.
- **Contention awareness** — when demand strains supply, the card warns:
  *"X other people are also looking to charge right now — no port is saved for you
  (FCFS). Head over now for the best chance; everyone sees this equally, no
  priority."* This drives urgency so nobody's shocked/entitled if a port is taken.
- **"From your profile"** context + carried-over home-charger setting.
- **Demo: simulate 10 colleagues** — shows the honest FCFS spread (distinct ports
  first, then shared ports → charger decides).

### Alerts
- **Notify me when a port frees** (formerly "handoff line") — when every port is
  busy, join to be **pinged in order** the moment one opens, so you don't circle
  the lot. It's a **heads-up, not a reservation** — first to physically plug in
  wins. If a notified driver no-shows, the ping passes to the next person.
- **Turnover / urgency nudges:**
  - ~10 min before you have enough to get home: *"Plan to move — Z colleagues are
    looking to charge right now."*
  - When full/idle: *"Please move your vehicle — Z colleagues are waiting."*
  Naming the count (**Z**) makes a charged driver more urgent about freeing the
  port.

### Profile
- **Your typical pattern** — usual days, plug-in time, favorite station, avg
  session length, and an overnight/daytime badge, all from the real 159231V
  history (114 sessions; correctly detected as an **overnight/off-peak charger**
  rather than idle-shamed). Informs the recommendation; never grants priority.

---

## Real-time-first architecture
The whole live layer is a **simulated real-time engine** (`backend/sim.py`)
seeded from the real historical distributions — arrival weighting, per-station
charge durations, and **departure times sampled from the real weekday end-time
distribution** so the live counts match history (peak-full midday, emptying by
7 PM). It's demo-ready today, and a live telemetry feed can replace the schedule
generator later **without touching the API**.

---

## Data notes
- **ChargePoint CSV** — real, drives everything (occupancy curve, durations,
  ghost detection, the featured user profile).
- **Work orders (xlsx)** — real maintenance feed; flags broken chargers so
  they're excluded.
- **Blink CSV** is included but is **not Juno Beach** (it's "Midtown PGA" stations
  and the rows are log-download events, not charging sessions), so it is not used
  for occupancy. Other-brand ports (to reach the 106-port campus total) are
  labelled simulated until their feeds come online.

---

## Quick start
Backend (port 8001):
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py
```
Frontend (port 5174, proxies `/api` → 8001):
```bash
cd frontend
npm install
npm run dev   # open http://localhost:5174
```

## Demo tips
- The clock is static and starts at the actual current time. Drag the **Open
  chargers by time** slider (Home): ~0–4 open midday, rising to ~100/106 by 7 PM.
- On **Recommend**, tap "Planning to use", then "I've plugged in", then advance
  the clock past your finish time → the "you're charged, please move" urgency
  nudge fires with the count of people looking.
- At a saturated moment, use **Notify me when a port frees** (Alerts), then check
  out from another port to see the next person get pinged.
- Tap **Demo: simulate 10 colleagues** to see the honest FCFS spread.

## Stack
React 18 · Vite · Tailwind · Framer Motion · Recharts · FastAPI · Pandas
