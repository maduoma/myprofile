# Morning Blueprint — Android App
## Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Morning Blueprint — "Your Sacred 3-Hour Morning" |
| **Platform** | Android (native) |
| **Document version** | 1.0 |
| **Date** | 2026-07-16 |
| **Status** | Draft for stakeholder review |
| **Authors** | Product Management / Product Owner / Business Analysis |
| **Source artifact** | `MorningBlueprint_Prototype.html` (interactive HTML/JS prototype, 14 screens) |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Prototype Audit](#2-prototype-audit)
3. [Product Vision, Goals & Success Metrics](#3-product-vision-goals--success-metrics)
4. [Target Users & Personas](#4-target-users--personas)
5. [Scope](#5-scope)
6. [Core Domain Model](#6-core-domain-model)
7. [Epics, User Stories & Acceptance Criteria](#7-epics-user-stories--acceptance-criteria)
8. [Functional Requirements (Consolidated)](#8-functional-requirements-consolidated)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Technical Architecture](#10-technical-architecture)
11. [Data Model (Room)](#11-data-model-room)
12. [Navigation & Screen Map](#12-navigation--screen-map)
13. [Permissions & Platform Policies](#13-permissions--platform-policies)
14. [Design System & UX Requirements](#14-design-system--ux-requirements)
15. [Accessibility](#15-accessibility)
16. [Analytics & Instrumentation](#16-analytics--instrumentation)
17. [Security & Privacy](#17-security--privacy)
18. [Release Plan & Milestones](#18-release-plan--milestones)
19. [Risks & Mitigations](#19-risks--mitigations)
20. [Open Questions](#20-open-questions)
21. [Appendix A — Seed Content](#21-appendix-a--seed-content)
22. [Appendix B — Requirements Traceability Matrix](#22-appendix-b--requirements-traceability-matrix)

---

## 1. Executive Summary

**Morning Blueprint** is a faith-based morning-routine and personal-discipline app that guides users through a structured, three-hour early-morning regimen (3:00–6:00 AM) organized into **3 phases** and **8 timed sessions**: spiritual alignment (thanksgiving, Scripture meditation, sacred silence), declaration (spoken biblical affirmations, day planning, intercession), and sharpening (skill development, physical preparation).

The HTML prototype demonstrates the complete UX vision: session timers, per-session alarms, a Scripture reader with translation options, a reflection journal, spoken declarations (text-to-speech), a "Big Three" daily priority planner, streak/heatmap analytics, and an offline-first, privacy-first posture ("All data stays on your device").

This PRD converts the prototype into a full specification for a **native Android app** built with **Kotlin, Jetpack Compose (Material 3), Room, DataStore, Hilt, WorkManager, and AlarmManager**, closing the functional gaps identified in the audit (Section 2.4) — most critically: real alarm scheduling, genuine session-completion tracking, computed streak/analytics, background-safe timers, and durable local persistence.

**Positioning:** A premium, distraction-free "spiritual operating system for the morning." No feed, no social graph, no account requirement. The product's moat is depth of ritual support and total data privacy, not network effects.

---

## 2. Prototype Audit

### 2.1 Method

The audit reviewed the prototype's markup, styles, state model, event handling, persistence layer, and all 14 rendered screens as a senior PM/PO/BA would: cataloguing implemented behavior, identifying demo-only stubs, surfacing implicit product rules, and flagging gaps that a production Android app must resolve.

### 2.2 Screen Inventory (What the Prototype Contains)

| # | Screen | Route (prototype) | Purpose | Key elements observed |
|---|--------|-------------------|---------|----------------------|
| 1 | Splash | `splash` | Brand moment, app boot | Animated logo, tagline "Your Sacred 3-Hour Morning", 2.8 s auto-advance |
| 2 | Onboarding | `onboarding` | Value proposition, 3 slides | "Wake With Purpose" (3 AM premise), "Three Sacred Hours" (phase overview), "Armed & Ready" (permission preview: alarms; privacy pledge: on-device data); Skip; page dots |
| 3 | Home | `home` | Daily dashboard | Greeting ("Good Morning, Warrior."), live clock, streak badge (🔥 21), today's progress bar (n/8 sessions) with per-session tick strip, 3 phase cards with progress rings and "Active" chip, Daily Scripture teaser, Quick Access grid (Declarations, Big Three, Alarms, Journal), primary CTA "Begin Session N" |
| 4 | Alarm Setup | `alarms` | Configure the 8 session alarms | Grouped by phase; per-session toggle with time + duration; "Save All Alarms" |
| 5 | Sessions | `sessions` | Browse/launch sessions by phase | Phase tab bar, phase header with completion count, session cards (emoji, time range, duration, description, Done chip or Play button) |
| 6 | Active Session | `active-session` | Run a timed session | 250 px circular countdown ring with % complete, session prompt quote, reset / pause-resume / skip-to-next controls, "Journal" shortcut, "Complete" action |
| 7 | Scripture | `scripture` | Daily verse & meditation | Featured verse card with reference and translation, translation switcher (NIV/KJV/ESV), bookmark toggles, 3 meditation prompts, "More Scriptures" list |
| 8 | Journal | `journal` | Reflection archive | Entry list with session chip, relative date, preview text; filter tabs (All + 3 phases); New Entry actions |
| 9 | Journal Editor | `journal-entry` | Create/edit an entry | Session picker (8 sessions), date/time box, serif long-form text area, Voice Note button (stub), Tag Entry button (stub), Save with empty-content validation |
| 10 | Declarations | `declarations` | Manage affirmation library | 6 seeded declarations across categories (Finances, Wisdom, Health, Family, Work, Purpose), category filter tabs, per-declaration active toggle, "Read" entry point |
| 11 | Declarations Readout | `declarations-readout` | Guided spoken declarations | Full-screen card per declaration, index indicator (n / total), **Web Speech API TTS** (rate 0.86, pitch 0.95), animated "Speaking…" bars, Previous/Next/Done |
| 12 | Big Three Planner | `planner` | Daily top-3 priorities | 3 priority slots with editable text, category selector (Work/Purpose/Finances/Health/Family), done checkmarks, completion counter (n/3), Psalm 37:5 card, "Commit to the Lord" CTA |
| 13 | Analytics | `analytics` | Progress & discipline stats | Current streak ring (21, vs. best 34), stat grid (longest streak, total sessions 312, total hours 147), per-phase completion rate bars (89/76/68 %), 5-week × 7-day intensity heatmap with legend, weekly summary (6/7 days, 21/24 sessions, 18 h) |
| 14 | Settings | `settings` | Preferences & data controls | Profile card (name, streak, session count); Manage Alarms; **Discipline Mode** ("disable snooze permanently"); Phase Transition Alerts; Vibration Pattern; Bible Translation (NIV/KJV/ESV/NKJV); Theme (Dark/Light/Auto); Export Journal (print/PDF); Backup Data (JSON download); Restore Backup (file picker + validation); version footer "v1.0.0 · Built for warriors · Offline-first" |

Persistent bottom navigation on Home / Sessions / Journal / Progress / Settings. Transient toast component for confirmations.

### 2.3 Implicit Product Rules Extracted from the Prototype

These behaviors are encoded in prototype logic and must be treated as requirements:

- **PR-01** The day is composed of exactly **3 phases × 8 sessions** with fixed default times (3:00–6:00 AM) and durations (see Appendix A). Phase 3 has 2 sessions; phases 1–2 have 3 each.
- **PR-02** Each session has an identity: title, emoji, phase color, time range, duration, description, and a **reflection prompt** shown during the timer.
- **PR-03** A journal entry belongs to a session (and therefore a phase); the journal is filterable by phase.
- **PR-04** Saving an empty journal entry is rejected with feedback ("Write a reflection before saving").
- **PR-05** Declarations have a category and Scripture reference; only **active** declarations are included in the readout flow; if none are active, the full library is read.
- **PR-06** TTS reads declaration text at a deliberately calm pace (rate ≈ 0.86, pitch ≈ 0.95).
- **PR-07** The Big Three is always exactly **3 slots**, each with a category and done state; restore logic backfills to 3.
- **PR-08** Theme supports **dark / light / auto** (follow system); dark is default. Theme switch also updates the system chrome color.
- **PR-09** Translation preference is global and mirrored in Scripture and Settings (NIV/KJV/ESV/NKJV; default NIV).
- **PR-10** Backup export is versioned JSON (`{version, exportedAt, data:{alarms, translation, bookmarked, journal, activeDeclarations, tasks, prefs}}`); restore **validates and sanitizes** every field (whitelisted enums, length caps: journal ≤ 500 entries / 20,000 chars each, tasks ≤ 500 chars, file ≤ 1 MB) and rejects invalid files.
- **PR-11** Reduced-motion preference disables animations (`prefers-reduced-motion` respected).
- **PR-12** Privacy pledge is explicit in onboarding: *"All data stays on your device."* No network calls exist anywhere in the prototype (CSP `connect-src 'none'`).
- **PR-13** Default alarm state: sessions 1–5 enabled, 6–8 disabled.
- **PR-14** Skipping onboarding is allowed on slides 1–2; slide 3 requires the explicit "Begin My Morning Blueprint" commitment.

### 2.4 Gap Analysis — Prototype vs. Production (Audit Findings)

| ID | Severity | Finding | Production requirement |
|----|----------|---------|------------------------|
| G-01 | **Critical** | **No real alarms.** Alarm toggles only persist a boolean; nothing is scheduled. | Implement exact alarms via `AlarmManager.setExactAndAllowWhileIdle` / `setAlarmClock`, full-screen alarm activity, per-session scheduling, reboot re-registration (Epic E2). |
| G-02 | **Critical** | **Session completion is hardcoded** (`completed=[1,2,3]` everywhere). "Complete" shows a toast but records nothing. | Persist `SessionCompletion` records keyed by date + session; drive Home, Sessions, and Analytics from real data (Epic E3). |
| G-03 | **Critical** | **All analytics are fake**: streak 21, best 34, 312 sessions, 147 hours, phase rates 89/76/68 %, heatmap array — all constants. | Compute every metric from completion history; define streak semantics (Section 7, E7). |
| G-04 | **Critical** | **Timer is foreground-only and demo-seeded** (starts at `duration − 47 s`; state lost on navigation/process death; no sound at zero). | Foreground-service-backed timer with notification, survives process death and screen off, end-of-session chime + haptic (E4). |
| G-05 | High | **Journal dates are display strings** ("Today", "Yesterday") with no timestamps; entries store only a `preview`; no delete; edit overwrites preview. | Full entries with `createdAt`/`updatedAt` epoch timestamps, body + derived preview, delete with undo, edit history-safe (E6). |
| G-06 | High | **Translation switcher doesn't switch text** — one NIV string per verse regardless of selection; only 3 verses exist; the daily verse never rotates. | Bundle a licensed/public-domain Scripture set per supported translation (KJV/WEB as minimum public-domain baseline); daily-verse rotation plan (E5). See Open Question Q1 on translation licensing. |
| G-07 | High | **Discipline Mode does nothing.** Marketed as "disable snooze permanently" but no enforcement exists. | Define and enforce: hides snooze on alarm screen, requires deliberate dismiss action (E2, FR-ALM-09). |
| G-08 | High | **No day rollover / timezone logic.** "Today" is undefined; nothing resets at day boundaries. | Define the product day (calendar day, device timezone; sessions attributed to the day the alarm fires), midnight/boot/timezone-change rollover via WorkManager (E3, FR-TRK-06). |
| G-09 | Medium | **Voice Note and Tag Entry are toast stubs.** | Voice-to-text dictation via `SpeechRecognizer` (P1); entry tagging/favorites (P1) (E6). |
| G-10 | Medium | **Declarations are a fixed set of 6**; no create/edit/delete. | Custom declaration CRUD with category + optional reference (E5). |
| G-11 | Medium | **Readout index edge case**: next/done logic counts `activeDeclarations` while the displayed list falls back to *all* declarations when none are active — index math diverges. | Single source of truth for the readout playlist; index always bound to the resolved list (E5, FR-DEC-06). |
| G-12 | Medium | **Streak badge/profile name hardcoded** ("Morning Warrior"). | Optional display name captured in onboarding; all counters computed (E1). |
| G-13 | Medium | **Persistence is `localStorage`** (single JSON blob, easily lost, no migrations). | Room database + Preferences DataStore; schema migrations; Android Auto Backup rules (Section 10–11). |
| G-14 | Medium | **Back navigation is partial** (custom history stack; `popstate` only). | Predictive back, correct Compose back-stack semantics, state restoration (E9). |
| G-15 | Medium | **Export = `window.print()`**. | Journal export to PDF/Markdown via SAF (`CREATE_DOCUMENT`), share sheet (E8). |
| G-16 | Low | **Phase Transition Alerts & Vibration Pattern toggles have no behavior.** | Phase-change notifications with distinct haptic pattern; user-selectable vibration intensity (E2). |
| G-17 | Low | **Meditation prompts are static** (same 3 for every verse). | Prompt sets per verse or rotation pool (E5). |
| G-18 | Low | **No notification, DND, or battery-optimization handling.** | Runtime `POST_NOTIFICATIONS`, exact-alarm permission flow, OEM battery-optimization education screen, DND-bypass option for alarm channel (E2, Section 13). |
| G-19 | Low | **Bookmark scope limited to the 3 seeded verses.** | Bookmarks for any verse in the library; bookmarks view (E5). |
| G-20 | Low | **No first-run permission requests** — onboarding only *shows* a permission checklist. | Real permission choreography on slide 3 / first alarm save (E1). |

### 2.5 What the Prototype Gets Right (Preserve These)

- Coherent, premium visual identity (gold/violet on near-black; Cormorant Garamond serif for spiritual content, Outfit sans for UI) with a complete light theme.
- Disciplined component system (cards, chips, rings, toggles, tabs, toasts) that maps cleanly to a Compose design system.
- Offline-first, zero-account, zero-tracking posture — a genuine differentiator worth preserving as a hard constraint.
- Input sanitization habits (HTML escaping, restore validation, file-size caps) — carry the same rigor into the Android import path.
- Accessibility foundations: focus-visible outlines, aria labels/pressed states, reduced-motion support, `aria-live` region, screen-reader-only labels.

---

## 3. Product Vision, Goals & Success Metrics

### 3.1 Vision

Help purpose-driven Christians win their day before sunrise by making a demanding 3-hour morning ritual **structured, guided, and habit-forming** — with total privacy.

### 3.2 Product Goals

| # | Goal | Measure |
|---|------|---------|
| PG-1 | Users reliably wake and start Phase 1 | Alarm→session-start conversion ≥ 60 % by week 4 |
| PG-2 | The routine becomes a habit | Median streak ≥ 7 days at D30; D30 retention ≥ 25 % |
| PG-3 | Deep engagement, not shallow opens | ≥ 4 sessions completed per active day; ≥ 3 journal entries/week per WAU |
| PG-4 | Zero-compromise privacy | 0 network permissions in MVP; 100 % of user data exportable |
| PG-5 | Store quality | Play rating ≥ 4.6; crash-free sessions ≥ 99.7 %; ANR < 0.05 % |

### 3.3 Non-Goals (Explicitly Out of Scope for V1)

- Social features, community feeds, sharing streaks publicly.
- Cloud accounts, sign-in, or server-side sync.
- iOS, tablet-optimized, or Wear OS apps (phone-portrait first; large-screen support is adaptive, not redesigned).
- In-app purchases/subscriptions (monetization strategy deferred — see Q4).
- Full Bible reader (curated verse library only in V1).
- Audio content hosting (worship music, guided audio) — TTS only.

---

## 4. Target Users & Personas

### Persona 1 — "The Kingdom Entrepreneur" (primary)

Faith-driven founder/professional, 28–50, already attempts early rising, reads Scripture daily, journals inconsistently. Owns a mid-to-high-end Android phone. **Needs:** an alarm that actually gets them up at 3 AM, structure so the 3 hours don't dissolve, and evidence of progress. **Frustrations:** generic habit apps feel secular and shallow; alarm apps and Bible apps don't talk to each other. Prototype journal seeds (investor decks, ML pipeline reviews, mentorship calls) confirm this persona.

### Persona 2 — "The Growing Disciple" (secondary)

Young professional or student, 20–35, aspires to a disciplined devotional life but has never sustained one. Will start with a **partial routine** (Phase 1 only, or later start times). **Needs:** flexibility to scale the blueprint down without feeling like a failure; gentle streak mechanics. This persona motivates FR-ALM-04 (per-session alarms/times) and the P1 "custom schedule" capability.

### Persona 3 — "The Intercessor" (secondary)

Mature believer, 45–65, prayer-focused, moderate tech comfort, may use larger fonts. **Needs:** legibility (dynamic type), simple navigation, reliable TTS for declarations, print/export of journals. Motivates accessibility requirements (Section 15) and journal export (E8).

---

## 5. Scope

### 5.1 In Scope — MVP (V1.0)

Epics E1–E9 at priority **P0** (see Section 7): onboarding & permissions, exact session alarms with Discipline Mode, real session tracking & day rollover, foreground-service timer, Scripture & declarations with TTS, journal CRUD, computed analytics, backup/restore + journal export, settings/theming.

### 5.2 In Scope — V1.1 (P1)

Voice-note dictation, custom declarations, entry tagging & search, custom session times ("My Blueprint" schedule editor), home-screen widget (Glance), phase-transition alerts, richer heatmap (12 weeks), notification actions (mark complete from notification).

### 5.3 Deferred (P2 / Backlog)

Wear OS companion, encrypted cloud backup (user-keyed), verse-of-the-day notification, guided audio, multi-language localization beyond en, Play Asset Delivery for additional translations, tablet two-pane layouts.

---

## 6. Core Domain Model

### 6.1 The Blueprint

| Phase | Name | Window | Sessions |
|-------|------|--------|----------|
| 1 | **The Alignment Hour** 🌙 | 3:00–4:00 AM | Thanksgiving (15 m) · Scripture Meditation (30 m) · Sacred Silence (15 m) |
| 2 | **The Declaration Hour** ⚡ | 4:00–5:00 AM | Declarations (20 m) · Day Planning (30 m) · Intercession (10 m) |
| 3 | **The Sharpening Hour** 🔥 | 5:00–6:00 AM | Skill Sharpening (30 m) · Body Preparation (30 m) |

Session metadata (emoji, description, prompt, color) is seed content — Appendix A.

### 6.2 Key Definitions (resolve prototype ambiguity)

- **Product day:** calendar date in the device's current timezone. A session completion is attributed to the date at the moment of completion; sessions completed between 00:00 and the configured start time still count for that calendar day.
- **Session completed:** user taps **Complete** during/after a session, **or** the timer reaches 0 and the user confirms. Skipped sessions are recorded as `SKIPPED`, not completed.
- **Day counted toward streak:** ≥ 1 session completed that calendar day (MVP default; "strict mode" requiring all enabled sessions is a P2 setting).
- **Streak:** count of consecutive counted days ending today (or yesterday if today has no activity yet — the streak is "at risk", not broken, until the day ends).
- **Phase completion rate:** completed ÷ (enabled sessions in phase × days in range) over trailing 30 days.

---

## 7. Epics, User Stories & Acceptance Criteria

Priorities: **P0** = MVP-blocking · **P1** = V1.1 · **P2** = backlog.
IDs are stable for traceability (Appendix B).

---

### Epic E1 — First-Run Experience & Onboarding

> Replicate the prototype's 3-slide onboarding with real permission choreography.

**E1-S1 (P0)** — *As a new user, I see a branded splash and 3-slide onboarding so I understand the blueprint before committing.*
- AC1: Splash uses the AndroidX SplashScreen API; total cold-start-to-onboarding ≤ 2 s on a mid-tier device.
- AC2: Slides match prototype content: value proposition, 3-phase overview (with live phase cards), commitment slide.
- AC3: Skip available on slides 1–2 only; slide 3 requires "Begin My Morning Blueprint".
- AC4: Onboarding shows exactly once; completing it is persisted (DataStore) and survives app updates.

**E1-S2 (P0)** — *As a new user, I grant the permissions the app needs, with plain-language rationale.*
- AC1: Slide 3 requests, in order and each with rationale UI: `POST_NOTIFICATIONS` (runtime), exact-alarm capability (`SCHEDULE_EXACT_ALARM` special access screen where required by OS version).
- AC2: Every permission is denyable; the app remains fully usable, with degraded-mode messaging (e.g., "Alarms need exact-alarm access — enable in Settings").
- AC3: The privacy pledge ("All data stays on your device") is displayed verbatim on slide 3.
- AC4: On OEMs with aggressive battery optimization, a one-time education card links to the relevant OEM setting (dismissible, never blocking).

**E1-S3 (P1)** — *As a new user, I can enter an optional display name so the greeting is personal.*
- AC1: Optional text field; default greeting "Good Morning, Warrior." when unset; name shown in Settings profile card; editable later.

---

### Epic E2 — Alarms & Wake System *(closes G-01, G-07, G-13/16/18/20)*

> The single most important capability: get the user up at 3 AM, reliably.

**E2-S1 (P0)** — *As a user, I enable/disable an alarm per session so my phone wakes me for each block I've committed to.*
- AC1: Alarm Setup lists all 8 sessions grouped by phase, with per-session toggle, time, duration — visual parity with prototype.
- AC2: Defaults on first run: sessions 1–5 ON, 6–8 OFF (PR-13).
- AC3: Toggling persists immediately (Room) and (re)schedules/cancels the exact alarm atomically; "Save All Alarms" confirms with a toast/snackbar (parity) but saving is not deferred to it.
- AC4: Scheduled alarms use `AlarmManager.setAlarmClock` (surfaces in system alarm indicator) targeting the next occurrence of the session's start time.

**E2-S2 (P0)** — *As a sleeping user, the alarm wakes me with sound, vibration, and a full-screen alarm UI even when the phone is locked/Dozing.*
- AC1: Alarm fires within ±1 min of target time with the device idle/Dozing (verified on Pixel + one Samsung + one Xiaomi test device).
- AC2: Full-screen intent activity over lock screen: session emoji/name/phase color, current time, **Start Session**, **Snooze (9 min)**, **Dismiss**.
- AC3: Dedicated notification channel `alarms` at `IMPORTANCE_HIGH`, alarm audio attributes (`USAGE_ALARM` — respects alarm volume stream, plays through DND).
- AC4: Alarm sound continues ≤ 5 min or until user action; auto-dismisses to a missed-alarm notification afterward.
- AC5: All enabled alarms re-register on `BOOT_COMPLETED`, timezone change, and app update.
- AC6: "Start Session" deep-links directly into the Active Session screen with the timer armed.

**E2-S3 (P0)** — *As a user pursuing discipline, I can enable Discipline Mode so snooze disappears entirely.*
- AC1: When ON, the alarm screen shows no snooze affordance; dismiss requires an intentional gesture (long-press ≥ 2 s or slider), preventing sleepy taps.
- AC2: Turning Discipline Mode ON shows a confirmation dialog stating the consequence; turning it OFF is immediate.
- AC3: Setting persists and applies to all session alarms.

**E2-S4 (P1)** — *As a user, I receive a phase-transition alert when one hour ends and the next begins.*
- AC1: When Phase Transition Alerts is ON, a high-priority notification + distinct haptic pattern fires at 4:00 and 5:00 AM on active days (i.e., days where any earlier session was started).
- AC2: Vibration Pattern setting selects among 2–3 patterns (calm default); OFF disables haptics app-wide except alarms.

**E2-S5 (P1)** — *As a user with a nonstandard schedule, I can shift session times so the blueprint fits my life.*
- AC1: "My Blueprint" editor lets the user shift the whole block's start time (grid snaps to 5 min); session order and durations preserved by default; individual durations editable within phase bounds.
- AC2: Alarm times, home CTA, and analytics all respect the custom schedule.

---

### Epic E3 — Session Tracking & the Product Day *(closes G-02, G-08)*

**E3-S1 (P0)** — *As a user, my session completions are recorded so the app reflects what I actually did.*
- AC1: Completing a session writes a `SessionCompletion {date, sessionId, completedAt, elapsedSeconds, outcome}` record; duplicates for the same date+session upsert.
- AC2: Home progress bar/tick strip, phase-card rings, Sessions screen "Done" states, and phase header counts all derive from today's records — no hardcoded values anywhere.
- AC3: Skip records `outcome=SKIPPED` and does not count toward completion or streaks.
- AC4: "Begin Session N" CTA on Home targets the first incomplete enabled session for today; if all are complete, the CTA becomes "Blueprint complete — view Progress" (navigates to Analytics).

**E3-S2 (P0)** — *As a user, the app rolls over cleanly at day boundaries.*
- AC1: At local midnight (WorkManager periodic + on-app-foreground check), today's dashboard resets; history is preserved.
- AC2: Timezone changes re-anchor "today" without corrupting or double-counting history (dates stored as `LocalDate` strings, not epoch-derived at read time).
- AC3: A completed day snapshot (sessions completed, minutes) is queryable for analytics without rescanning raw records (materialized daily summary).

---

### Epic E4 — Active Session Timer *(closes G-04)*

**E4-S1 (P0)** — *As a user in a session, I see a beautiful countdown that keeps running when I lock the screen or switch apps.*
- AC1: Circular progress ring, MM:SS, % complete, session prompt — visual parity with prototype (colors per phase).
- AC2: Timer state lives in a foreground service (`shortService`/`specialUse`-appropriate type: use `mediaPlayback`-adjacent is wrong — use `FOREGROUND_SERVICE_SPECIAL_USE` or countdown pattern with `setExact` fallback; final choice documented in tech design) with an ongoing notification showing remaining time and Pause/Complete actions.
- AC3: Timer survives process death and reboot mid-session by persisting `endsAtElapsedRealtime`/`endsAtWallClock` and reconstructing on restart.
- AC4: Controls: pause/resume, reset (confirm dialog if > 20 % elapsed), skip-to-next-session, Complete.
- AC5: At 0: gentle chime (alarm-channel-adjacent, respects volume), haptic, auto-marks completion pending one-tap confirm ("Session complete — Continue to next / Journal this").
- AC6: Only one session timer may run at a time; starting another prompts to end the current one.
- AC7: The screen may stay on during an active session (user setting, default ON while charging).

**E4-S2 (P1)** — *As a user, I can jot a journal reflection without leaving the session.*
- AC1: "Journal" opens the editor pre-filled with the current session and returns to the still-running timer on save/back.

---

### Epic E5 — Scripture & Declarations *(closes G-06, G-10, G-11, G-17, G-19)*

**E5-S1 (P0)** — *As a user, I read a rotating daily Scripture with meditation prompts.*
- AC1: A bundled verse library (≥ 90 curated verses, themed around purpose/wisdom/provision/discipline) rotates deterministically by date; the same verse shows all day.
- AC2: Verse card, reference, translation label, bookmark toggle, and ≥ 3 meditation prompts (per-verse or themed pool) — parity with prototype layout.
- AC3: Translation switcher actually switches the verse text. MVP ships translations we can legally bundle (see Q1); unavailable translations are hidden, not shown-but-fake.
- AC4: Bookmarks persist per verse; a Bookmarks filter/list is reachable from the Scripture screen.

**E5-S2 (P0)** — *As a user, I manage which declarations are active and read them aloud with me.*
- AC1: Seed library = the 6 prototype declarations (Appendix A) with category chips and references; per-item active toggle; category filter tabs; active count in header.
- AC2: Readout mode presents one declaration per screen with index (n/total), Previous/Next/Done — the playlist is resolved **once on entry** (active set, or full library if none active) fixing the prototype's index divergence (G-11).
- AC3: TTS via Android `TextToSpeech`: rate 0.86, pitch 0.95 (PR-06), stop on navigation/exit, audio focus requested (transient may-duck), works offline with the device's default voice.
- AC4: If TTS is unavailable, the Speak button shows a graceful error and the visual readout still works.

**E5-S3 (P1)** — *As a user, I create my own declarations.*
- AC1: CRUD with text (≤ 500 chars), category (existing set + "Custom"), optional Scripture reference; custom items are flagged and excluded from future seed migrations; deletable with undo.

---

### Epic E6 — Journal *(closes G-05, G-09)*

**E6-S1 (P0)** — *As a user, I write, edit, and delete timestamped reflections tied to sessions.*
- AC1: Entry = session, phase (derived), body (≤ 20,000 chars), createdAt/updatedAt; list shows session chip, relative date ("Today", "Yesterday", else date — computed, never stored), 2-line preview.
- AC2: Filter tabs: All + per phase (parity); default sort newest-first.
- AC3: Editor: session picker (8 sessions), date/time display, serif body field, Save; empty-body save is rejected with the prototype's message (PR-04).
- AC4: Delete via swipe or overflow, with 5-second undo snackbar.
- AC5: Unsaved editor content survives process death (rememberSaveable + draft in DataStore).

**E6-S2 (P1)** — *As a user, I dictate reflections hands-free.*
- AC1: Mic button starts on-device `SpeechRecognizer` dictation (with `RECORD_AUDIO` runtime permission + rationale); text streams into the editor at the cursor; works offline where the device supports offline recognition.

**E6-S3 (P1)** — *As a user, I tag and search entries.*
- AC1: Star/tag toggle on entries; "Starred" filter; full-text search over body (Room FTS4/FTS5).

---

### Epic E7 — Analytics & Streaks *(closes G-03)*

**E7-S1 (P0)** — *As a user, I see my real streak, totals, phase rates, and heatmap.*
- AC1: Current streak & personal best computed per Section 6.2 definitions; streak badge on Home and hero ring on Analytics agree at all times.
- AC2: Stat grid: longest streak (days), total sessions completed (all time), total hours (Σ elapsedSeconds).
- AC3: Phase completion rate bars over trailing 30 days (per Section 6.2).
- AC4: 5-week × 7-day heatmap of sessions/day with 4 intensity buckets (0 / 1–2 / 3–5 / 6–8) and legend; week starts Sunday (parity) — locale-aware start is P2.
- AC5: Weekly summary: active days (n/7), sessions (n/enabled-total), hours in routine, for the current week.
- AC6: Empty states designed for day-1 users (no fake numbers, encouraging copy).

**E7-S2 (P1)** — *As a returning user, streak-at-risk messaging nudges me without shaming me.*
- AC1: If yesterday counted and today has no completion by the user's last session end time, Home shows "Streak at risk" state; optional reminder notification (opt-in).

---

### Epic E8 — Data: Backup, Restore, Export *(closes G-13, G-15; preserves PR-10)*

**E8-S1 (P0)** — *As a privacy-conscious user, I back up everything to a file I control and restore it later.*
- AC1: Backup writes versioned JSON (schema v2 superset of the prototype's v1: + completions, custom declarations, schedule, name) via SAF `CREATE_DOCUMENT`; share-sheet export also offered.
- AC2: Restore via SAF `OPEN_DOCUMENT`; accepts v1 (prototype) and v2 files; validates/sanitizes with the same rigor as the prototype (size cap 5 MB, whitelisted enums, length caps, unknown fields ignored); invalid file → clear error, no partial writes (transactional).
- AC3: Restore is preceded by a destructive-action confirmation ("Replaces current data") and creates an automatic pre-restore safety backup.
- AC4: Android Auto Backup (`dataExtractionRules`) covers the Room DB and DataStore for device-to-device migration; documented limitation: excluded if user disables it.

**E8-S2 (P0)** — *As a user, I export my journal for printing or archiving.*
- AC1: Export journal (all or filtered) to a paginated PDF (title, session, timestamp, body) and to Markdown; via SAF or share sheet.

---

### Epic E9 — App Shell, Settings & Theming *(closes G-12, G-14; preserves PR-08/09/11)*

**E9-S1 (P0)** — *As a user, I navigate five main areas via bottom navigation with correct back behavior.*
- AC1: Bottom bar: Home, Sessions, Journal, Progress, Settings — icons/labels per prototype; selected-tab tint gold.
- AC2: Navigation Compose with per-tab back-stack preservation; system/predictive back never exits mid-flow unexpectedly; deep links: `active-session/{id}`, `journal-entry/{id}`, `alarms`.
- AC3: Full-screen flows (Active Session, Readout, onboarding) hide the bottom bar (parity).

**E9-S2 (P0)** — *As a user, I control theme, translation, alerts, and see app info in Settings.*
- AC1: Settings groups/items match the prototype inventory (Section 2.2 #14) with functional equivalents for every row.
- AC2: Theme dark/light/auto applies instantly app-wide including status/navigation bar styling; auto follows system.
- AC3: Reduced-motion: respect the system animator/transition scale — no decorative animation when disabled (PR-11).
- AC4: Version footer with app version from BuildConfig.

---

## 8. Functional Requirements (Consolidated)

Numbered requirements referenced by QA; each maps to stories above.

**Alarms**
- FR-ALM-01 Schedule/cancel an exact alarm per enabled session at its configured time. (E2-S1)
- FR-ALM-02 Alarms fire in Doze, over lock screen, through DND (alarm channel). (E2-S2)
- FR-ALM-03 Full-screen alarm UI with Start / Snooze / Dismiss. (E2-S2)
- FR-ALM-04 Per-session enable state; defaults 1–5 ON. (E2-S1)
- FR-ALM-05 Re-register alarms on boot, timezone change, app update. (E2-S2)
- FR-ALM-06 Snooze = 9 min, max 3 snoozes per alarm. (E2-S2)
- FR-ALM-07 Missed-alarm notification after 5 min unanswered. (E2-S2)
- FR-ALM-08 Alarm audio uses alarm stream/volume; vibration per setting. (E2-S2/S4)
- FR-ALM-09 Discipline Mode removes snooze and requires deliberate dismiss. (E2-S3)

**Tracking & Timer**
- FR-TRK-01 Persist completion records (date, session, outcome, elapsed). (E3-S1)
- FR-TRK-02 All dashboards derive from persisted data. (E3-S1)
- FR-TRK-03 One active timer max; foreground service + ongoing notification. (E4-S1)
- FR-TRK-04 Timer survives process death/reboot. (E4-S1)
- FR-TRK-05 End-of-timer chime/haptic + confirm completion. (E4-S1)
- FR-TRK-06 Day rollover at local midnight; timezone-safe date attribution. (E3-S2)

**Content**
- FR-CNT-01 Daily verse rotation, deterministic by date. (E5-S1)
- FR-CNT-02 Translation switch changes displayed text; only real translations offered. (E5-S1)
- FR-CNT-03 Verse bookmarks CRUD + list. (E5-S1)
- FR-CNT-04 Declaration active-set management; category filters. (E5-S2)
- FR-CNT-05 TTS readout (rate .86/pitch .95), audio focus, offline-capable. (E5-S2)
- FR-CNT-06 Readout playlist resolved once on entry (fixes G-11). (E5-S2)

**Journal & Planner**
- FR-JRN-01 Entry CRUD with timestamps, session link, 20k char cap. (E6-S1)
- FR-JRN-02 Phase filters; newest-first. (E6-S1)
- FR-JRN-03 Empty-save rejection with feedback. (E6-S1)
- FR-PLN-01 Exactly 3 priority slots: text, category, done. (Planner parity; part of E3 dashboards)
- FR-PLN-02 Big Three resets each product day; yesterday's tasks archived and viewable in history (P1). 
- FR-PLN-03 "Commit to the Lord" persists and confirms (toast parity).

**Analytics**
- FR-ANL-01..05 Streak, best, totals, phase rates, heatmap, weekly summary — computed per Section 6.2. (E7-S1)

**Data**
- FR-DAT-01 Versioned JSON backup/restore (v1-compatible import). (E8-S1)
- FR-DAT-02 Sanitizing, transactional restore with safety backup. (E8-S1)
- FR-DAT-03 Journal export to PDF + Markdown. (E8-S2)
- FR-DAT-04 Auto Backup rules for DB + DataStore. (E8-S1)

**Shell**
- FR-SHL-01 Five-tab bottom nav, per-tab back stacks, deep links. (E9-S1)
- FR-SHL-02 Theme dark/light/auto; instant apply. (E9-S2)
- FR-SHL-03 Settings inventory functional parity. (E9-S2)

---

## 9. Non-Functional Requirements

| ID | Category | Requirement |
|----|----------|-------------|
| NFR-01 | Performance | Cold start ≤ 2.0 s (P50, mid-tier device); warm start ≤ 800 ms; all screens 60 fps scroll (no frame > 32 ms at P95). Baseline Profiles shipped. |
| NFR-02 | Reliability | Alarm delivery ≥ 99.5 % within ±60 s on certified devices; crash-free sessions ≥ 99.7 %; ANR rate < 0.05 %. |
| NFR-03 | Offline | 100 % of functionality works with no network, forever. The MVP requests **no** `INTERNET` permission. |
| NFR-04 | Battery | Idle overnight drain attributable to app < 1 %; no wakelocks outside alarm fire + active timer service. |
| NFR-05 | Storage | App ≤ 30 MB installed (excl. user data); journal supports ≥ 10,000 entries without list jank (paging). |
| NFR-06 | Compatibility | `minSdk 26` (Android 8.0), `targetSdk` = latest stable (36); portrait-primary, responsive to fold/large screens (no crash, sane layout). |
| NFR-07 | Data integrity | Zero data loss across app update, force stop, reboot; Room migrations tested for every schema bump; restore is atomic. |
| NFR-08 | Accessibility | Per Section 15 (TalkBack, 200 % font scale, contrast ≥ 4.5:1, touch targets ≥ 48 dp, reduced motion). |
| NFR-09 | Privacy | No analytics SDKs, no ads SDKs, no PII leaves the device. Play Data Safety form: "No data collected." |
| NFR-10 | Security | Backup files contain no secrets; input from restored files sanitized (length caps, enum whitelists, HTML-free rendering by construction in Compose). |
| NFR-11 | Localization-ready | All strings in resources; en-US at launch; RTL-safe layouts. |
| NFR-12 | Testability | ≥ 80 % unit coverage on domain layer (streaks, rollover, alarm scheduling math); UI tests for the 6 P0 critical journeys. |

---

## 10. Technical Architecture

### 10.1 Stack

| Concern | Choice |
|---|---|
| Language | Kotlin 2.x (K2), coroutines + Flow |
| UI | Jetpack Compose + Material 3, custom design system tokens (Section 14); Compose Navigation; SplashScreen API |
| Architecture | MVVM + UDF (ViewModel → StateFlow → Compose), Clean-ish layering: `ui` / `domain` (use-cases, pure Kotlin) / `data` (Room, DataStore, alarms) |
| DI | Hilt |
| Persistence | Room (entities §11) + Preferences DataStore (prefs) + FTS5 (journal search, P1) |
| Background | AlarmManager (`setAlarmClock`) + BroadcastReceivers (fire, boot, tz); foreground service (timer); WorkManager (rollover, daily summary materialization) |
| Media/Voice | Android `TextToSpeech`; `SpeechRecognizer` (P1); `VibratorManager` haptics |
| Export | SAF (`CREATE_DOCUMENT`/`OPEN_DOCUMENT`); `android.graphics.pdf.PdfDocument` for PDF |
| Serialization | kotlinx.serialization (backup JSON) |
| Build/quality | Gradle version catalogs, detekt + ktlint, R8, Baseline Profiles, Macrobenchmark, LeakCanary (debug) |
| Testing | JUnit5 + Turbine + Robolectric (domain/data), Compose UI tests + Maestro smoke (critical journeys) |

### 10.2 Module Layout

```
:app                 // wiring, navigation host, MainActivity, AlarmActivity
:core:designsystem   // theme tokens, typography, components (Card, Chip, Ring, Toggle…)
:core:domain         // models, use-cases (pure JVM): StreakCalculator, DayRollover, PlaylistResolver
:core:data           // Room, DataStore, repositories, backup codec
:core:alarm          // scheduling, receivers, full-screen alarm, timer service
:feature:onboarding  :feature:home  :feature:sessions  :feature:timer
:feature:scripture   :feature:declarations  :feature:journal
:feature:planner     :feature:analytics  :feature:settings
```

### 10.3 Key Design Decisions

- **D1 — No network permission in MVP.** Enforces NFR-03/09 structurally; any future sync feature requires a new PRD.
- **D2 — Wall-clock alarm scheduling with `setAlarmClock`.** Exempt from Doze, shows the OS alarm indicator, and communicates intent honestly to the platform. Each fired alarm schedules the next occurrence (no repeating alarms).
- **D3 — Timer truth = target end timestamp,** not a ticking counter: `endsAt = now + remaining` persisted on every pause/resume; UI derives remaining time. Survives death/reboot cheaply.
- **D4 — Seed content as versioned assets** (JSON in `assets/`, loaded into Room on first run with a `seedVersion`), so content updates ship without schema migrations and never clobber user edits (custom declarations flagged `isCustom`).
- **D5 — Dates stored as ISO `LocalDate`/`Instant` strings** in Room, computed relative labels at render time (fixes G-05 class of bugs).

---

## 11. Data Model (Room)

```
sessions            (id PK, phase, title, emoji, defaultStartMin, durationMin,
                     description, prompt, sortOrder)              // seeded
alarm_configs       (sessionId PK→sessions, enabled, startMinOverride?)
session_completions (id PK, date TEXT ISO, sessionId FK, outcome ENUM[COMPLETED|SKIPPED],
                     completedAt INSTANT, elapsedSec INT, UNIQUE(date, sessionId))
daily_summaries     (date PK, sessionsCompleted, minutes, counted BOOL)   // materialized
journal_entries     (id PK, sessionId FK, body TEXT, createdAt, updatedAt,
                     starred BOOL DEFAULT 0)                       // + FTS5 shadow (P1)
declarations        (id PK, category, text, reference?, isCustom BOOL, isActive BOOL,
                     sortOrder)                                    // 6 seeded
scriptures          (id PK, reference, translation, text, themeTag)       // seeded per translation
bookmarks           (scriptureId PK→scriptures, createdAt)
tasks               (date, slot INT 1..3, text, category, done BOOL, PK(date, slot))
timer_state         (singleton: sessionId, endsAtWallClock, remainingAtPauseSec?, running BOOL)
```

**DataStore (prefs):** theme, translation, vibrationPattern, phaseAlerts, disciplineMode, displayName, onboardingDone, keepScreenOnInSession, seedVersion, scheduleShiftMin.

**Backup JSON v2** = all of the above (minus timer_state) + `{version:2, exportedAt}`; importer also accepts prototype v1 shape (maps `journal[].preview → body`, relative dates → best-effort createdAt).

---

## 12. Navigation & Screen Map

```
Splash → (first run) Onboarding ×3 → Home
                     └─(returning)──→ Home

Bottom nav (state-preserving tabs):
  Home ── Begin Session ──────────────→ ActiveSession(sessionId)   [full-screen]
   ├─ streak badge ─→ Progress(Analytics)
   ├─ phase card ───→ Sessions(phase)
   ├─ verse card ───→ Scripture
   └─ quick grid ───→ Declarations | Planner | Alarms | Journal
  Sessions ─ session card ─→ ActiveSession(sessionId)
  Journal ─ entry / + ─→ JournalEditor(entryId?)
  Progress (Analytics)
  Settings ─→ Alarms | (backup/restore/export dialogs)

Declarations ─ Read ─→ Readout [full-screen]
ActiveSession ─ Journal ─→ JournalEditor(prefilled) ─ back ─→ ActiveSession (timer intact)
AlarmActivity (over lock screen) ─ Start ─→ ActiveSession(sessionId)

Deep links: mb://session/{id}, mb://journal/{id}, mb://alarms
```

Back behavior: system back inside a tab pops that tab's stack; on a tab root, back exits (predictive back animation supported). Full-screen flows confirm before discarding meaningful state (running timer → "End session?"; dirty editor → "Discard draft?").

---

## 13. Permissions & Platform Policies

| Permission / access | When requested | Justification shown to user | Fallback if denied |
|---|---|---|---|
| `POST_NOTIFICATIONS` | Onboarding slide 3 | Alarms & session updates | Banner on Home + Alarms explaining alarms can't alert |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` (per target SDK rules; app qualifies as alarm app) | First alarm enable | "Wake you at the exact minute" | Inexact fallback + warning chip on Alarms screen |
| `USE_FULL_SCREEN_INTENT` | Manifest (Play declaration: alarm app) | Lock-screen alarm UI | Heads-up notification fallback |
| `RECEIVE_BOOT_COMPLETED` | Manifest | Re-arm alarms after restart | — |
| `FOREGROUND_SERVICE` + typed FGS | Manifest | Session timer notification | — |
| `VIBRATE` | Manifest | Haptics | — |
| `RECORD_AUDIO` (P1) | First mic use | Voice dictation | Typed input only |

**Play compliance:** Alarm-clock use case declared for exact alarms & FSI; Data Safety = no collection; no restricted permissions beyond the above; content rating: Everyone (religious references).

---

## 14. Design System & UX Requirements

Tokens derived from the prototype (single source of truth for Compose theme):

- **Colors (dark):** bg `#07070F`, surface `#0C0C1C`, card `#101028`, border `#1A1A32`; **gold `#C9A44A`** (primary/brand), violet `#7C5DBE` (secondary), blue `#4B90D6` (phase 1), green `#52BE7C` (success), red `#E25560` (error); text `#EDE7DC` / `#8A879E` / `#4C4A66`. Full light-palette counterpart per prototype. Phase identity colors: P1 blue, P2 gold, P3 light-violet `#A07EE0`.
- **Typography:** *Cormorant Garamond* (serif — verses, quotes, timer numerals, big stats), *Outfit* (sans — UI). Bundle both fonts (licensing: OFL) — no runtime font download (offline rule).
- **Shape:** cards 18 dp radius, buttons 16–17 dp, chips pill; hero cards up to 24 dp.
- **Signature elements to reproduce:** progress rings with glow, gradient primary button (gold→violet), streak flame badge, verse card gradient, timer ring with drop-shadow glow, heatmap grid, press-scale interaction (~0.965 scale), toast confirmations (Compose Snackbar styled to parity).
- **Motion:** fade-in 380 ms, slide-up 400 ms, spring scale-in; breathe/shimmer loops for speaking bars & splash; all gated by reduced-motion (NFR-08).
- **Dynamic color (Material You):** OFF — brand palette is part of the product's identity. Revisit post-launch (Q6).

---

## 15. Accessibility

- A11Y-01 Full TalkBack support: every actionable element has a content description; toggles expose state (`stateDescription`); timer announces at 50 %/25 %/1 min marks via `LiveRegion` (polite).
- A11Y-02 Font scaling to 200 % without truncation of critical text (session titles may ellipsize; times/numbers never do).
- A11Y-03 Contrast ≥ 4.5:1 for text in both themes (audit the gold-on-dark small text — prototype `--txt-3 #4C4A66` on `#07070F` fails and must be reserved for decorative text only).
- A11Y-04 Touch targets ≥ 48 dp (prototype's 28 px task-check and 36 px icon buttons must be padded up).
- A11Y-05 Reduced motion: disable decorative animation; keep functional transitions instant.
- A11Y-06 Alarm dismiss/snooze operable via switch access; Discipline-Mode long-press has an accessible alternative (accessibility action).
- A11Y-07 TTS readout screen usable with screen reader without double-speaking (manage focus + `aria`-equivalent semantics).

---

## 16. Analytics & Instrumentation

Constraint NFR-09 (no data leaves the device) still allows **on-device, user-facing** metrics (Epic E7) and **local** debug logging. For product learning:

- MVP: no telemetry. Success measured via Play Console vitals (crashes/ANRs/uninstalls), store reviews, and opt-in user interviews.
- P2 (if ever): strictly opt-in, anonymized, self-hosted telemetry — requires its own privacy review and PRD amendment. The Play Data Safety label change is a launch-blocking review gate.

Internal quality KPIs tracked in CI: startup time (Macrobenchmark), alarm-delivery integration test pass rate, DB migration test matrix.

---

## 17. Security & Privacy

- SP-01 All data local; no `INTERNET` permission (MVP) — structurally verifiable in the manifest.
- SP-02 Restore path treats files as hostile input: 5 MB cap, JSON schema validation, enum whitelists, string length caps, transactional apply (mirrors and extends prototype behavior PR-10).
- SP-03 Journal content may be deeply personal: exclude app from Android's "sensitive content" screenshots? — No; instead offer optional **app lock** (biometric via `BiometricPrompt`, P1) and exclude journal screens from the recents thumbnail (`FLAG_SECURE` optional setting, P1).
- SP-04 Backups are plaintext JSON by design (user-controlled); UI copy warns where the file is saved. Encrypted backup (user passphrase) is P2.
- SP-05 No third-party SDKs other than AndroidX/JetBrains.
- SP-06 Threat review of exported PDFs (no path traversal in filenames; sanitize entry text into PDF as text, never HTML/webview).

---

## 18. Release Plan & Milestones

| Milestone | Contents | Exit criteria |
|---|---|---|
| **M0 — Foundation** (wk 1–3) | Modules, design system, Room schema, seed pipeline, navigation shell, theming | Design-system screen gallery matches prototype side-by-side; CI green |
| **M1 — Wake & Track** (wk 4–7) | Epics E2 (alarms), E3 (tracking), E4 (timer) | Alarm reliability test matrix passes on 3 OEMs; timer survives kill/reboot; dashboards fully data-driven |
| **M2 — Content & Journal** (wk 8–10) | E5 (Scripture/declarations + TTS), E6 (journal), planner parity | All P0 ACs pass; translation licensing resolved (Q1) |
| **M3 — Insight & Data** (wk 11–12) | E7 (analytics), E8 (backup/restore/export), E1 polish | v1-backup import verified against prototype export; empty states done |
| **M4 — Hardening** (wk 13–14) | NFR sweep: perf, battery, a11y audit, migration tests, Play listing, closed beta | NFR-01..12 measured & met; beta cohort ≥ 20 users; crash-free ≥ 99.7 % |
| **GA — v1.0** (wk 15) | Production rollout 10 % → 100 % | PG-5 vitals stable through staged rollout |
| **v1.1** (+6 wk) | P1 stories: dictation, custom declarations, tags/search, custom schedule, widget, phase alerts | — |

Team assumption: 2 Android engineers, 1 designer (part-time), 1 PM/QA hybrid. Adjust linearly.

---

## 19. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|-----------|
| R1 | **OEM battery managers kill alarms** (Xiaomi/Huawei/OnePlus aggressive modes) → users miss 3 AM wake | High | Critical | `setAlarmClock` (highest-priority path), OEM education screen (dontkillmyapp-style guidance), missed-alarm detection + in-app diagnostic ("Alarm health check"), test matrix across 3+ OEMs |
| R2 | **Bible translation licensing** (NIV/ESV/NKJV are commercial) | High | High | Launch with public-domain KJV/WEB bundled; pursue licenses for NIV/ESV in parallel; never display a translation label whose text we don't have (fixes G-06 honestly) |
| R3 | Exact-alarm & full-screen-intent policy tightening on future Android/Play versions | Medium | High | App squarely fits the "alarm clock" carve-outs; declare use case in Play Console; track policy changes each targetSdk bump |
| R4 | 3 AM habit is extremely demanding → churn after novelty | Medium | Medium | P1 custom schedule (E2-S5) and partial-routine grace (streak counts ≥ 1 session); empathetic streak-at-risk copy |
| R5 | TTS voice quality varies by device/offline state | Medium | Low | Tune rate/pitch per PR-06; document voice-pack install path; visual readout always works |
| R6 | Religious content sensitivities / store review friction | Low | Medium | Everyone rating; no health/medical claims; content is user-facing scripture, standard for the category |
| R7 | Data loss perception (no cloud) | Medium | Medium | Prominent backup nudges (monthly reminder, after 50 journal entries), Auto Backup enabled, one-tap export |
| R8 | Scope creep from prototype's polish (pixel-parity rabbit holes) | Medium | Medium | Design-system gallery approved at M0 = the parity contract; deviations logged, not litigated per-screen |

---

## 20. Open Questions

| # | Question | Owner | Needed by |
|---|----------|-------|-----------|
| Q1 | Which Bible translations can we license or must we substitute (KJV/WEB public domain vs. NIV/ESV/NKJV commercial)? Budget? | PM + Legal | M2 start |
| Q2 | Streak semantics: is "≥ 1 session/day" the right MVP bar, or should enabled-sessions-completed drive it? (Current spec: ≥ 1; strict mode P2.) | PM | M1 start |
| Q3 | Snooze policy final numbers (9 min × 3?) and whether Discipline Mode should also lock alarm-disable during night hours ("commitment device"). | PM + Design | M1 start |
| Q4 | Monetization: paid app vs. free + future premium (custom schedules, encrypted backup)? Affects Play listing at GA. | PM + Stakeholders | M3 |
| Q5 | Display-name capture in onboarding (E1-S3): V1.0 or V1.1? | PM | M0 |
| Q6 | Offer Material You dynamic color as an opt-in theme later? | Design | Post-GA |
| Q7 | Should "Body Preparation"/"Skill Sharpening" integrate with Health Connect (steps/exercise) — P2 exploration? | PM | Backlog |
| Q8 | Week start (Sunday fixed vs. locale) for heatmap — prototype is Sunday. | Design | M3 |

---

## 21. Appendix A — Seed Content

### A.1 Sessions

| ID | Phase | Time | Title | Dur | Emoji | Prompt |
|----|-------|------|-------|-----|-------|--------|
| 1 | 1 | 3:00–3:15 | Thanksgiving | 15 m | 🙏 | "What 5 things are you most grateful to God for today?" |
| 2 | 1 | 3:15–3:45 | Scripture Meditation | 30 m | 📖 | "What is God revealing to you through this Scripture right now?" |
| 3 | 1 | 3:45–4:00 | Sacred Silence | 15 m | ✨ | "Be still. What is God speaking to you in this moment?" |
| 4 | 2 | 4:00–4:20 | Declarations | 20 m | ⚡ | "Declare God's promises with faith and boldness. Your words carry power." |
| 5 | 2 | 4:20–4:50 | Day Planning | 30 m | 🎯 | "What 3 actions will most advance your purpose today?" |
| 6 | 2 | 4:50–5:00 | Intercession | 10 m | 💫 | "Who needs your intercession today? Lift them to the Father." |
| 7 | 3 | 5:00–5:30 | Skill Sharpening | 30 m | 📚 | "What one discipline will you strengthen in your craft today?" |
| 8 | 3 | 5:30–6:00 | Body Preparation | 30 m | 💪 | "Your body is a temple. Honor God through physical excellence today." |

(Descriptions per prototype; carried verbatim into seed JSON.)

### A.2 Declarations (6 seeded)

| Category | Reference | Text (abridged) |
|----------|-----------|-----------------|
| Finances | Deut. 28:12–13 | "The Lord shall open unto me His good treasure…" |
| Wisdom | Prov. 2:6 | "God gives me wisdom, knowledge, and understanding…" |
| Health | Ps. 27:1 | "The Lord is the strength of my life…" |
| Family | Josh. 24:15 | "As for me and my house, we will serve the Lord…" |
| Work | Ps. 1:3 | "Whatever I set my hand to prospers…" |
| Purpose | Ps. 139:14 | "I am fearfully and wonderfully made for such a time as this…" |

### A.3 Scriptures (prototype set — to be expanded to ≥ 90 for rotation, FR-CNT-01)

Jeremiah 29:11 · Joshua 1:8 · Proverbs 3:5–6 (plus Psalm 37:5 used in Planner). Meditation-prompt pool per Section 2.2 #7.

### A.4 Task Categories

Work · Purpose · Finances · Health · Family.

### A.5 Defaults

Alarms: sessions 1–5 ON / 6–8 OFF · Theme: dark · Translation: NIV (subject to Q1) · Vibration: ON · Phase alerts: ON · Discipline Mode: OFF · Active declarations: Finances, Wisdom, Family, Work.

---

## 22. Appendix B — Requirements Traceability Matrix

| Audit gap | Requirement(s) | Epic/Story | Milestone |
|-----------|----------------|-----------|-----------|
| G-01 no real alarms | FR-ALM-01..08 | E2-S1/S2 | M1 |
| G-02 hardcoded completions | FR-TRK-01/02 | E3-S1 | M1 |
| G-03 fake analytics | FR-ANL-01..05 | E7-S1 | M3 |
| G-04 demo timer | FR-TRK-03..05 | E4-S1 | M1 |
| G-05 journal dates/CRUD | FR-JRN-01..03 | E6-S1 | M2 |
| G-06 fake translations | FR-CNT-01/02 | E5-S1 + Q1 | M2 |
| G-07 Discipline Mode inert | FR-ALM-09 | E2-S3 | M1 |
| G-08 no day rollover | FR-TRK-06 | E3-S2 | M1 |
| G-09 voice/tag stubs | E6-S2/S3 | P1 | v1.1 |
| G-10 fixed declarations | E5-S3 | P1 | v1.1 |
| G-11 readout index bug | FR-CNT-06 | E5-S2 | M2 |
| G-12 hardcoded profile | E1-S3 | P0/P1 (Q5) | M0/v1.1 |
| G-13 localStorage | §10–11 | Architecture | M0 |
| G-14 back handling | FR-SHL-01 | E9-S1 | M0 |
| G-15 print-only export | FR-DAT-03 | E8-S2 | M3 |
| G-16 inert alert toggles | E2-S4 | P1 | v1.1 |
| G-17 static prompts | E5-S1 AC2 | P0 | M2 |
| G-18 no permission flows | E1-S2, §13 | P0 | M0–M1 |
| G-19 bookmark scope | FR-CNT-03 | E5-S1 | M2 |
| G-20 fake onboarding perms | E1-S2 | P0 | M0 |

---

*End of document. This PRD supersedes the prototype as the source of truth for the Android build; the prototype remains the visual-parity reference (Section 14).*
