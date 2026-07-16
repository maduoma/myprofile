# 🌙 Morning Blueprint

**Your Sacred 3-Hour Morning** — a faith-based morning-routine and personal-discipline app for Android that guides you through a structured 3:00–6:00 AM regimen of spiritual alignment, declaration, and sharpening.

> *Offline-first · No accounts · No ads · No tracking · All data stays on your device.*

> **Note:** This file is the root `README.md` for the Morning Blueprint Android repository. Until that repository is created, it lives here alongside the product and engineering documents it references.

---

## Table of Contents

- [What It Does](#what-it-does)
- [The Blueprint](#the-blueprint)
- [Feature Overview](#feature-overview)
- [Privacy Commitment](#privacy-commitment)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Building & Running](#building--running)
- [Testing](#testing)
- [Quality Gates & CI](#quality-gates--ci)
- [Permissions](#permissions)
- [Project Documents](#project-documents)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## What It Does

Morning Blueprint turns a demanding early-morning discipline into a guided, trackable daily ritual:

- **Wakes you** with reliable, exact-time alarms for each session — including a *Discipline Mode* that removes snooze entirely.
- **Guides you** through eight timed sessions with reflection prompts, a daily Scripture with meditation questions, and spoken biblical declarations (text-to-speech).
- **Captures what you hear** in a session-linked reflection journal and a daily "Big Three" priority planner.
- **Shows your growth** with real streaks, phase completion rates, a 5-week heatmap, and lifetime totals.
- **Keeps everything yours** — the app has no network permission at all; your data never leaves your device unless *you* export it.

## The Blueprint

| Phase | Hour | Sessions |
|-------|------|----------|
| 🌙 **The Alignment Hour** | 3:00–4:00 AM | Thanksgiving (15 m) · Scripture Meditation (30 m) · Sacred Silence (15 m) |
| ⚡ **The Declaration Hour** | 4:00–5:00 AM | Declarations (20 m) · Day Planning (30 m) · Intercession (10 m) |
| 🔥 **The Sharpening Hour** | 5:00–6:00 AM | Skill Sharpening (30 m) · Body Preparation (30 m) |

## Feature Overview

| Area | Highlights |
|------|-----------|
| ⏰ **Alarms** | Per-session exact alarms (`setAlarmClock`), full-screen lock-screen alarm UI, snooze policy (9 min × 3), Discipline Mode (hold-to-dismiss, no snooze), boot/timezone-safe rescheduling, missed-alarm notifications |
| ⏱ **Session Timer** | Foreground-service countdown that survives app kill, reboot, and screen-off; per-phase themed progress ring; session prompts; pause/resume/skip/complete |
| 📖 **Scripture** | Rotating daily verse (deterministic, no repeats until the library cycles), translation switcher, bookmarks, meditation prompts |
| ⚡ **Declarations** | Categorized declaration library with active sets; guided full-screen readout with calm-paced text-to-speech (rate 0.86 / pitch 0.95) |
| 📚 **Journal** | Session-linked reflections, phase filters, drafts that survive process death, delete with undo, PDF & Markdown export |
| 🎯 **Big Three** | Three daily priority slots with categories, committed each morning, reset at day rollover |
| 📊 **Progress** | Current & best streak, total sessions/hours, per-phase completion rates (trailing 30 days), 5-week heatmap, weekly summary — all computed, never estimated |
| 🎨 **Design** | Premium dark theme (gold/violet on near-black) with full light theme and system-auto mode; Cormorant Garamond + Outfit typography; reduced-motion support |
| 💾 **Your Data** | Versioned JSON backup/restore (validated, transactional, with automatic safety backup), Android Auto Backup, journal export |

## Privacy Commitment

This app is engineered — not just promised — to be private:

- **No `INTERNET` permission.** The manifest cannot make network calls; CI fails any change that adds one.
- **No analytics, ads, or third-party SDKs.** Dependencies are AndroidX/Kotlin only.
- **No accounts.** Nothing to sign up for, nothing to leak.
- **Full data portability.** One-tap export of everything you've created, in open formats (JSON, PDF, Markdown).
- Play Data Safety declaration: **"No data collected."**

## Tech Stack

| Concern | Technology |
|---|---|
| Language | Kotlin 2.x (K2), Coroutines + Flow |
| UI | Jetpack Compose · Material 3 · custom design system |
| Navigation | Navigation Compose (type-safe, `@Serializable` routes) |
| DI | Hilt (KSP) |
| Persistence | Room (single source of truth) · Preferences DataStore |
| Background | AlarmManager (`setAlarmClock`) · Foreground Services · WorkManager |
| Voice | Android `TextToSpeech` (offline-capable) |
| Serialization | kotlinx.serialization |
| Quality | detekt · ktlint · Android Lint · Roborazzi screenshots · Macrobenchmark + Baseline Profiles |
| Testing | JUnit5 · Turbine · Robolectric · Compose UI Test · Maestro |

**SDK levels:** `minSdk 26` · `targetSdk 36` · JVM 17. No KAPT (KSP only), no network stack, no image-loading library (all assets are local vectors/emoji).

## Architecture

MVVM + Unidirectional Data Flow over strict, module-enforced layering:

```
┌──────────────────────────────────────────────────────────┐
│ UI          :feature:*   Compose screens + ViewModels     │
│                 ↓ StateFlow<UiState> / UiEvent ↑          │
│ Domain      :core:domain pure JVM — models, use-cases,    │
│                          calculators, repo interfaces     │
│                 ↑ implemented by                          │
│ Data        :core:data   Room, DataStore, backup, seed    │
│             :core:alarm  AlarmManager, receivers, timer   │
└──────────────────────────────────────────────────────────┘
```

Key design decisions (full ADRs in [`docs/adr/`](docs/adr/)):

- **Single-activity Compose app** plus a minimal `AlarmActivity` that renders over the lock screen in under 500 ms.
- **One-shot self-rescheduling alarms** via `setAlarmClock` — the only Doze-proof path — with a six-trigger idempotent reconciler.
- **Timer truth = persisted end timestamps**, not ticks: zero drift, free process-death recovery.
- **Seed content as versioned JSON assets** so Scripture/declaration updates ship without DB migrations and never touch user edits.
- **Dates stored as ISO text** (`java.time`), relative labels ("Today") computed at render time only.

## Project Structure

```
morning-blueprint/
├── app/                    # MainActivity, nav host, DI wiring, manifest
├── build-logic/            # Gradle convention plugins + module-graph guard
├── core/
│   ├── designsystem/       # MbTheme, tokens, typography, shared components
│   ├── ui/                 # routes, snackbar, permissions, previews
│   ├── domain/             # pure JVM: models, use-cases, calculators
│   ├── data/               # Room, DataStore, repositories, seed, backup, export
│   ├── alarm/              # scheduler, receivers, AlarmActivity, TimerService
│   └── testing/            # fakes, fixtures, test rules
├── feature/
│   ├── onboarding/  home/  sessions/  timer/  scripture/
│   ├── declarations/  journal/  planner/  analytics/  settings/
├── baselineprofile/        # startup + scroll benchmarks, profile generator
└── docs/                   # PRD, Tech Spec, ADRs, QA charters, Play declarations
```

The complete, binding file-level tree is in the [Technical Specification, §28](docs/MorningBlueprint_Android_TechSpec.md).

**Module rules (CI-enforced):** features depend only on `designsystem`/`ui`/`domain`; `domain` depends on nothing Android; no feature-to-feature dependencies.

## Getting Started

### Prerequisites

- **Android Studio** (latest stable) with the Android SDK for API 36
- **JDK 17**
- A device or emulator on **Android 8.0 (API 26)** or newer
- For alarm testing: a physical device is strongly recommended (Doze and OEM battery managers don't reproduce faithfully on emulators)

### Clone & Open

```bash
git clone <repository-url>
cd morning-blueprint
```

Open the project in Android Studio and let Gradle sync, or work entirely from the CLI as below.

## Building & Running

```bash
# Debug build (includes the design-system gallery screen and StrictMode)
./gradlew :app:assembleDebug

# Install on a connected device
./gradlew :app:installDebug

# Release bundle (R8 full mode, resource shrinking, baseline profiles)
./gradlew :app:bundleRelease
```

Build variants: `debug` (LeakCanary, StrictMode, component gallery, `.debug` app-id suffix) · `benchmark` (release-like, profileable) · `release`.

### Trying the alarm flow quickly

1. Run the app, complete onboarding, and grant notification + exact-alarm access.
2. Open **Home → Quick Access → Alarms** and enable a session.
3. To test without waiting for 3 AM, temporarily change the device clock, or use the hidden **Alarm Health Check** screen (Settings → tap the version row 5×) to inspect scheduled alarms and recent fire latency.

## Testing

```bash
./gradlew test                          # JVM unit tests (domain, data, ViewModels)
./gradlew :core:data:testDebugUnitTest  # DAO / migration / backup suites (Robolectric)
./gradlew verifyRoborazziDebug          # screenshot regression (light/dark/200% font)
./gradlew connectedDebugAndroidTest     # instrumented + 6 critical UI journeys
./gradlew :baselineprofile:connectedBenchmarkAndroidTest   # macrobenchmarks
```

Highlights of the suite:

- **Calculator tests** cover streak math across DST changes, timezone hops, and year boundaries, plus property-based invariants.
- **Backup fuzz corpus** proves malformed/hostile import files are rejected with zero partial writes; a real prototype-era export file is a committed fixture.
- **Timer recovery tests** kill the process and simulate reboots mid-session.
- **Six merge-blocking UI journeys**: onboarding, alarm toggle, session lifecycle, journal CRUD, declaration readout, backup/restore round-trip.

## Quality Gates & CI

Every PR must pass:

1. **Static** — ktlint, detekt, Android Lint, `manifest-guard` (no `INTERNET`, exported-component audit), module-graph rules
2. **Unit** — JVM tests with coverage gate (≥ 90 % on `:core:domain`)
3. **Data** — DAO, migration, and backup suites
4. **UI** — Compose tests + Roborazzi screenshot diffs
5. **Build** — release assembly + APK size gate (≤ 30 MB installed)

Nightly: macrobenchmarks (cold start ≤ 2.0 s P50; zero jank at a 10k-entry journal). Weekly: OSV dependency scan + Gradle dependency verification.

## Permissions

The app requests only what an alarm clock genuinely needs — each with in-app rationale, and every one denyable with graceful degradation:

| Permission | Why |
|---|---|
| `POST_NOTIFICATIONS` | Alarm, timer, and missed-session notifications |
| `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` | Wake you at the exact minute (bona fide alarm-app use case) |
| `USE_FULL_SCREEN_INTENT` | Alarm screen over the lock screen |
| `RECEIVE_BOOT_COMPLETED` | Re-arm your alarms after a restart |
| `FOREGROUND_SERVICE` (+ typed) | Keep the session timer running reliably |
| `VIBRATE` | Haptics |
| `RECORD_AUDIO` *(v1.1, just-in-time)* | Voice dictation in the journal |

**Never requested:** internet, location, contacts, storage (file access goes through the system file picker).

## Project Documents

| Document | Purpose |
|---|---|
| [Product Requirements Document](docs/MorningBlueprint_Android_PRD.md) | Prototype audit, personas, epics/user stories with acceptance criteria, NFRs, release plan, risks |
| [Technical Specification](docs/MorningBlueprint_Android_TechSpec.md) | Architecture, 12 ADRs, subsystem designs, Room schema, folder structure (§28), 14-phase execution plan (§29) |
| `docs/adr/` | Architectural decision records (living) |
| `docs/play/declarations.md` | Play Console policy declarations (exact alarms, FSI, FGS) |
| `docs/qa/a11y.md` | TalkBack / accessibility test charter |

The original interactive HTML prototype remains the **visual-parity reference**; the debug build's component gallery screen is the enforcement artifact.

## Roadmap

- **v1.0 (MVP)** — the full blueprint: alarms + Discipline Mode, background-safe timers, real tracking & streaks, Scripture & spoken declarations, journal, Big Three, analytics, backup/restore/export
- **v1.1** — custom schedules ("My Blueprint"), phase-transition alerts, voice dictation, custom declarations, journal tags & full-text search, home-screen widget, biometric app lock
- **Beyond** — encrypted user-keyed backups, verse-of-the-day notification, Wear OS companion, additional Bible translations, localization

## Contributing

1. Branch from `main` (trunk-based; `main` is always releasable).
2. Follow the conventions in the Tech Spec §26 — naming, one public class per file, stateless screens, strings in resources, comments for constraints only.
3. New files must match the binding tree in Tech Spec §28 (or an existing sibling pattern).
4. Decisions touching alarms, the timer, backup, or the architecture require an ADR.
5. PRs need green CI stages 1–5, one review, and a "tested how" section. Squash merge.

## License

License to be determined before public release — see the project tracker. Bundled fonts (Cormorant Garamond, Outfit) are licensed under the [SIL Open Font License](https://scripts.sil.org/OFL). Bundled Scripture texts are public-domain translations (KJV/WEB) unless a commercial translation license is obtained.

---

*Built for warriors · Offline-first · 🌙 3:00 AM is your strategic advantage.*
