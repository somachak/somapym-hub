# Command Centre -- Design Spec

**Date:** 2026-04-13
**Status:** Draft
**Stack:** React 19, Vite 8, React Router 7, Firebase Auth + Firestore

---

## Overview

Personal project management dashboard for a solo developer with ADHD. Tracks 5 active projects with focus on launching the Cosmetic AI Assistant by mid-May 2026. Built as a new route (`/dashboard`) in the existing somapym.com React app.

---

## Architecture

| Layer | Detail |
|-------|--------|
| **Frontend** | New `/dashboard` route in existing React + Vite app |
| **Auth** | Firebase Auth, Google sign-in, locked to `pixelartinc@gmail.com` ONLY |
| **Data** | Firestore collections: `projects`, `tasks`, `feedback` |
| **Styling** | Anthropic brand palette with pastel greens/blues; Poppins + Noto Sans + Lora fonts; Material Symbols icons (no emojis) |
| **Daily briefing** | Scheduled Claude task -- reads git + Firestore, emails summary via Gmail |

---

## Dashboard Sections

### 1. Top Bar
- Logo, "Command Centre" title, launch countdown badge, notifications icon, user avatar

### 2. Greeting
- Time-based greeting with context from last work session (pulled from Firestore)

### 3. Stats Row
Four cards:
- Days to Launch
- Open Tasks
- Overall Progress %
- Open Bugs

### 4. Milestone Progress
Four circular progress rings:
- Core Features
- Pipeline Stable
- Deploy Ready
- UI Polish

### 5. Activity Timeline
- Date-based feed from git commits + manual entries

### 6. Priority Tasks
- List with priority bars, type tags (Bug / Feature / Test / Polish)

### 7. Project Cards
- 4 cards with status dots, progress bars, stale day counts

---

## Firestore Schema

### `projects` collection

```
{
  name: string,
  status: "active" | "paused" | "done",
  priority: number,
  localPath: string,
  githubRepo: string,
  deployUrl: string,
  lastCommit: timestamp,
  lastWorked: timestamp,
  launchDate: timestamp | null,
  notes: string,
  progress: number          // 0-100
}
```

### `tasks` collection

```
{
  title: string,
  projectId: string,        // ref -> projects
  status: "todo" | "in-progress" | "done" | "blocked",
  type: "bug" | "feature" | "test" | "polish",
  priority: number,
  dueDate: timestamp | null,
  milestone: string,
  context: string,
  completedDate: timestamp | null
}
```

### `feedback` collection

```
{
  title: string,
  projectId: string,        // ref -> projects
  type: string,
  severity: "low" | "medium" | "high" | "critical",
  status: string,
  screenshotUrl: string | null,
  stepsToReproduce: string,
  source: string,
  linkedTaskId: string | null
}
```

---

## Firebase Auth Rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.token.email == 'pixelartinc@gmail.com';
    }
  }
}
```

React auth guard must also reject all users except `pixelartinc@gmail.com` before rendering any dashboard content.

---

## Color Palette (CSS Variables)

```css
:root {
  --bg: #faf9f5;
  --bg-secondary: #f0eee6;
  --surface: #ffffff;
  --text: #141413;
  --text-secondary: #3d3d3a;
  --text-muted: #87867f;
  --text-subtle: #b0aea5;
  --clay: #d97757;
  --sky: #6a9bcc;
  --olive: #788c5d;
  --cactus: #bcd1ca;
  --fig: #c46686;
  --pastel-blue: #c4d9ed;
  --pastel-green: #c8ddd4;
  --pastel-teal: #b8d8d0;
  --ivory-dark: #e8e6dc;
  --oat: #e3dacc;
  --border: rgba(20, 20, 19, 0.08);
}
```

---

## Daily Briefing (Scheduled Claude Task)

Runs every morning at 8:30 AM:

1. Read git log from all 4 repos via `gh` CLI
2. Read Firestore `tasks` and `feedback` for open items
3. Compose summary email:
   - What was done yesterday
   - Stale projects (no commits in 3+ days)
   - Priority tasks for today
   - Launch countdown
4. Send via Gmail to `pixelartinc@gmail.com`

---

## Implementation Phases

| Phase | Scope | Timing |
|-------|-------|--------|
| **1** | Dashboard UI + Firestore + Auth lockdown | Now |
| **2** | In-app feedback widget in Cosmetic AI app | This week |
| **3** | Daily email briefing, bidirectional Claude integration | Before launch |
| **4** | Shift to user metrics -- visits, signups, promotions | Post-launch |
