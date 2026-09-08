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
### ✅ Phase 1
- **App Usage Tracking**  
  Tracks what apps consume your time most, per device.

### 🚀 Coming Soon
- **Email, Calendar, and Health Data Integration**  
  Combine communication, scheduling, and wellbeing data for a holistic attention map.
- **Focus Notifications**  
  Smart reminders when you’re drifting from your goals.
- **Dynamic Balance Model**  
  Customize how strict or flexible Jiko should be with your free time — balance matters as much as productivity.

---

## Tech Stack
**Backend** ([backend/README.md](backend/README.md))
- Node.js 22, Express 5, TypeScript, Zod  
- PostgreSQL 15 + PostGIS (one database; see [DECISIONS.md](DECISIONS.md) for why DynamoDB was dropped)  
- Optional: Claude for Jiko's voice, AWS SNS for SMS  
- Target: AWS (RDS + one EC2/container); not deployed yet

**Clients**
- macOS menu-bar agent, Swift/SwiftUI ([apple/JikoMacOSAgent/README.md](apple/JikoMacOSAgent/README.md)) — working  
- iOS app (Swift / SwiftUI) — scaffold only  
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
- [SPRINT_2.md](SPRINT_2.md) — what's next  
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