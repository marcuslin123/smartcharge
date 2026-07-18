# SmartCharge

SmartCharge is a workplace EV charging app for the FPL Juno Beach campus. It uses real ChargePoint session data to help employees answer a practical question: **where should I plug in right now, fairly, without circling the lot?**

## Project Highlights

- Built a full-stack web app with a React/Vite frontend and FastAPI backend.
- Analyzed **4,758 real ChargePoint sessions** from January to June 2026 across 13 stations and 26 ports.
- Found that the garage was about **93% utilized from 8 AM to 4 PM**, which made "off-peak" recommendations ineffective during work hours.
- Identified that cars sat idle for a mean of **97 minutes** after charging finished, making turnover the most important capacity lever.
- Added data-driven ghost-charger detection, including excluding **JUNO BEACH 06** after a 53% zero-kWh rate was found and corroborated by work orders.
- Designed the app around **pure first-come, first-served behavior**: the app recommends and notifies, but never reserves a charger.

## Screenshots

| Home | Recommendation |
| --- | --- |
| ![Home screen](https://raw.githubusercontent.com/marcuslin123/smartcharge/main/screenshots/home.png) | ![Recommendation screen](https://raw.githubusercontent.com/marcuslin123/smartcharge/main/screenshots/recommend.png) |

## What I Built

### Live Availability Engine

The backend simulates real-time charger availability from historical ChargePoint behavior. It uses real distributions for arrivals, charge durations, and weekday departure times so the demo reflects the campus pattern: full during the workday, then gradually opening up after 5 PM.

The engine is designed so a live telemetry feed could replace the simulated schedule generator later without changing the API contract.

### Recommendation Flow

The main user flow gives one clear recommendation, such as "head to G05-A," instead of asking employees to interpret a dashboard.

The recommendation considers:

- current charger availability;
- broken or unreliable chargers;
- fair first-come-first-served behavior;
- home-charger status;
- range needed to get home;
- latest useful start time before the end of the workday.

### FCFS Coordination

A major design decision was removing remote holds and reservations. In a constrained garage, a digital hold could unfairly block someone already standing at the charger.

Instead, SmartCharge uses:

- **Planning / Watching** to show interest without claiming a port;
- **I've plugged in** to start an actual charging session only after the driver physically connects;
- contention warnings when multiple employees are looking for chargers;
- notify-me-when-free alerts when all ports are busy;
- turnover nudges when a car is charged or close to charged and colleagues are waiting.

### Data-Aware Product Decisions

The app changed direction based on what the data showed:

- Replaced "charge off-peak" advice because there was no meaningful workday off-peak window.
- Removed the live garage map from the main employee flow because it covered only 26 of 106 campus ports and pushed the decision back onto the user.
- Scaled live ChargePoint availability proportionally to the full 106-port campus until other charger feeds are available.
- Treated the Blink CSV as out of scope after determining it represented Midtown PGA log-download events, not Juno Beach charging sessions.
- Correctly classified the featured user profile as an overnight/off-peak charger instead of mislabeling them as an idle daytime user.

## Key Findings From the Data

| Finding | Product Impact |
| --- | --- |
| 23 to 25 of 26 ChargePoint ports were in use from 8 AM to 4 PM | Timing recommendations were not enough because the garage was full all day |
| Median session length was 6.6 hours, but only about 5.2 hours was active charging | Idle time became the main target for improving access |
| Cars were idle for a mean of 97 minutes after charging | Turnover nudges could free meaningful capacity without adding chargers |
| JUNO BEACH 06 had a 53% zero-kWh rate | The app excludes unreliable chargers from recommendations |
| Availability rises sharply after 5 PM | The time slider helps users preview when chargers are likely to open |

## Main Features

- **Home:** shows open chargers right now, projected availability by time, and excluded ghost chargers.
- **Recommend:** gives one actionable charger recommendation with profile and range context.
- **Alerts:** lets users request a notification when a charger opens, without creating a reservation.
- **Profile:** summarizes a user's typical charging pattern from historical behavior.
- **Demo simulation:** shows how recommendations spread across available ports while preserving FCFS behavior.

## Tech Stack

**Frontend:** React 18, Vite, Tailwind CSS, Framer Motion, Recharts  
**Backend:** FastAPI, Python, Pandas  
**Data:** ChargePoint sessions, maintenance work orders, cleaned charger metadata

## Quick Start

Run the backend on port 8001:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Run the frontend on port 5174:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5174
```

## Demo Tips

- Use the **Open chargers by time** slider on Home to compare midday saturation with evening availability.
- On Recommend, click **Planning to use**, then **I've plugged in**, then advance the clock past the finish time to see the turnover nudge.
- At a saturated moment, use **Notify me when a port frees** in Alerts, then check out from another port to see the next person get pinged.
- Click **Demo: simulate 10 colleagues** to see how the app spreads recommendations while staying honest about first-come-first-served access.

## Why This Project Matters

SmartCharge shows how product direction can change when real operational data contradicts the original assumption. The final app is not just a dashboard. It turns messy charger usage data into a practical employee workflow, balances fairness with urgency, and leaves a clear path from simulation to live telemetry.
