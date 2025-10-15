
# Jiko

AI that messages you when you’ve been scrolling too long. <br/>
This md file was created with assistance from AI, so don't take it all seriously it's just me organizing my thoughts 

### 🌐 Overview

Jiko is a background service that integrates with your device’s screen time, app usage, and activity data to understand what you’re doing in real time. When it detects that you’ve been on distracting apps for too long, it triggers a personalized AI chatbot to message you — like a friend who checks in and helps you refocus, log off, or take a break.

Think of it as:

“an AI accountability partner that actually notices when you start doomscrolling.”

## 💡 Core Idea

The service acts as a middleware layer between your phone’s activity data and an AI messaging system.

When a trigger condition is met (e.g., 30 minutes on TikTok or Instagram), it pings your connected chatbot service (Discord, WhatsApp, or SMS) and starts a conversation.

Example:

AI: “yo, it’s been 40 mins on Instagram. you good?”
You: “nah lemme just finish this reel.”
AI: “uh huh. you said that 10 mins ago.”

The chatbot can be fine-tuned on your (or maybe just my) personal messages so it speaks like you, making reminders and interactions feel more natural and personalized.

## ⚙️ System Architecture

 ┌────────────────────┐
 │   Device Monitor   │
 │  (screen time API) │
 └─────────┬──────────┘
           │
           ▼
 ┌────────────────────┐
 │   Event Analyzer   │
 │  (usage patterns,  │
 │   app categories)  │
 └─────────┬──────────┘
           │
           ▼
 ┌────────────────────┐
 │  Trigger Service   │
 │  (custom rules,    │
 │   thresholds)      │
 └─────────┬──────────┘
           │
           ▼
 ┌────────────────────┐
 │ AI Chatbot System  │
 │ (LLM backend + msg │
 │  integration layer)│
 └────────────────────┘


## 📱 Integrations
1. iOS / Android Screen Time APIs
    1. Track app usage durations, open/close events, and focus mode.
    2. Requires background permissions and secure local storage.
2. Messaging APIs (Twilio??)
    1. Discord bot, WhatsApp Business API, or Twilio SMS.
	2. Handles sending/receiving messages between user and AI agent.
3. AI Backend
	1. Hosted on an LLM API (OpenAI, Anthropic, etc).
	2. Personality configurable via system prompt.
    3. Trained on someone's message history
4. Other
    1. Canvas Integrations for homework, midterms, etc.
    2. Google Calendar for other scheduled shit
    3. Email for upcoming interview, commitments, etc.
    4. Apple Health to see recent workouts and meet user-set goals.

## 🔔 Trigger Rules

| Type                | Example                                                         | AI Response                                 |
|--------------------|-----------------------------------------------------------------|--------------------------------------------|
| Time-based          | 30 min on TikTok when you have a HW assignment due at 11:59     | “hey, you’ve got homework due soon. maybe take a break from TikTok?” |
| Category-based      | 45 min in Social Media during study hours                        | “you’ve been on socials too long, consider focusing on your work.”    |
| Frequency-based     | Opened Instagram 10x today                                       | “you really need to touch grass.”          |
| Nighttime usage     | Using phone past 2AM                                             | “go to sleep dawg.”                        |

## 🔐 Privacy
1. All activity data stays local unless user opts into cloud sync.
2. AI messages are anonymized and ephemeral.
3. Optional encrypted chat history.

## 🧠 Future Plans
	•	Apple Health + Google Fit integration → detect overall wellness.
	•	Emotion-aware AI responses (tone shifts depending on mood).
	•	Chrome extension that tracks web usage as well.
	•	“Focus Groups” — friends can see when others start doomscrolling.

## 🧩 Tech Stack

| Component       | Tech                            |
|-----------------|---------------------------------|
| Mobile Listener | Swift (iOS), Kotlin (Android)   |
| Backend Service | Node.js + PostgreSQL            |
| Chatbot         | Hosted LLM / LangChain      |
| Notifications   | Twilio                          |
| UI Dashboard    | React + Tailwind                |

## 🧍‍♂️Why

Because sometimes you need an AI to remind you you’ve been on your phone too damn long.
