# SmartCharge

SmartCharge is a workplace EV charging app for the NextEra Energy Juno Beach campus. It uses real ChargePoint session data to help employees answer a practical question: **where should I plug in right now, fairly, without circling the lot?**

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
