##
# 🧠 JIKO
**A personal behavioral assistant** that tracks where your focus goes — and helps you redirect it.

Jiko is built to understand your attention patterns across devices, using that data not to **trap** you, but to **free** you — to build consistency, structure, and balance.

---

## 🗂️ Table of Contents
1. [What Is Jiko Really?](#what-is-jiko-really)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Target Audience](#target-audience)
5. [Developer Goals](#developer-goals)
6. [Notes](#notes)

---

## What Is Jiko Really?
Jiko acts as an **antihero against social media apps** —  
instead of using user data to *increase* engagement, Jiko uses user data to *decrease* it.  
Where engagement farms try to maximize screen time, Jiko’s goal is to make focus intentional again.

It’s a personal behavioral system that consolidates signals from **app usage, email, calendar, and health data**,  
and translates them into insight and feedback. The ultimate goal is to help users *see* their focus drift in real time and gently redirect it toward what actually matters.

---

## Key Features
### ✅ Working today
- **App usage tracking** — what ate your time, per device, per day.
- **A rules engine** — "when X and Y, say Z", with cooldowns, a daily interrupt budget and quiet hours. Nothing unsolicited leaves without passing all three.
- **Messages that talk back** — a nudge arrives as a notification, an iMessage or an SMS, and "snooze 30", "done", "stricter" or plain English all land somewhere.
- **Calendar subscriptions** — paste a Canvas or Google Calendar ICS URL; it re-imports itself daily, so Jiko knows what is actually due.
- **Goals** — "3h of reading a week": a midweek check when you are behind pace, silence when you are not.
- **Sunday reflection** — one question a week, and monday's check-in refers to your answer.
- **Focus-aware** — a macOS Focus, or a pause on any device, holds nudges as a leased quiet window.
- **Your own voice** — a style guide built locally from your own texts, so the nudges sound like you.
- **"Why did I get this?"** — every nudge can name the firing behind it.

### 🚀 Coming Soon
- **Screen Time on iPhone** — needs Apple's FamilyControls entitlement.
- **Email** — the last unread signal.
- **A second person using it for a week** — the real test.

---

## Tech Stack
**Backend** ([backend/README.md](backend/README.md))
- Node.js 22, Express 5, TypeScript, Zod  
- PostgreSQL 15 + PostGIS (one database; see [DECISIONS.md](DECISIONS.md) for why DynamoDB was dropped)  
- Optional: Claude for Jiko's voice, AWS SNS for SMS (in and out)  
- Deployable: Dockerfile + `fly.toml`; migrations run from the release command, and a Postgres advisory lock keeps exactly one instance sweeping

**Clients**
- macOS menu-bar agent, Swift/SwiftUI ([apple/JikoMacOSAgent/README.md](apple/JikoMacOSAgent/README.md)) — working: usage tracking, notifications with inline reply, iMessage delivery, Focus awareness, launch at login  
- iOS app, Swift/SwiftUI — working: location and health sync, nudges with inline reply, today and settings  
- `apple/JikoKit` — the Swift package both agents share (API client, models, keychain)  
- Android (Kotlin) — not started

## Try it in two minutes
```bash
cd backend && npm ci && cp .env.example .env && npm run localdb && npm run dev
# in another shell:
bash backend/scripts/demo.sh
```
The demo signs up a throwaway user, labels Instagram as distracting, adds "OS midterm in 6 hours", fakes 25 minutes of scrolling, and prints what Jiko says and how it reacts to "snooze 30".

## Where things are
- [SPRINT_PLAN.md](SPRINT_PLAN.md) — what was planned and what shipped  
- [SPRINT_2.md](SPRINT_2.md) — the second sprint's backlog (shipped)  
- [SPRINT_3.md](SPRINT_3.md) — what's next  
- [DECISIONS.md](DECISIONS.md) — every non-obvious call, so you can override them  
- [backend/docs/triggers.md](backend/docs/triggers.md) — the rules engine contract

---

## Target Audience
Students and professionals who want to **redirect their time** into structured yet adaptable schedules.  
People who value balance and consistency over strict productivity.  
Jiko helps them identify *where time goes* and provides subtle, data-driven nudges to help them find their rhythm again.

> “Consistency is only possible with balance.”

---

## Developer Goals
- Get better at backend (Node, databases, system design)
- Build real-world architecture using AWS
- Design a clean, testable API for multi-device sync
- Get an internship, bruh 😭

---

## Notes
This README is more of a **dev journal** than a polished product doc.  
The goal is to track thinking as much as progress — so tone and direction may shift as Jiko evolves.

---