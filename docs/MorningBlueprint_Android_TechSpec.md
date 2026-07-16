# Morning Blueprint — Android App
## Technical Specification

| | |
|---|---|
| **Product** | Morning Blueprint — "Your Sacred 3-Hour Morning" |
| **Platform** | Android (native, phone-portrait primary) |
| **Document version** | 1.1 (adds §28 folder structure, §29 phased execution plan) |
| **Date** | 2026-07-16 |
| **Status** | Draft for engineering review |
| **Audience** | Android engineers, QA, PM, security review |
| **Companion documents** | `MorningBlueprint_Android_PRD.md` v1.0 (requirements, FR/NFR IDs referenced throughout) · `MorningBlueprint_Prototype.html` (visual-parity reference) |

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Architecture Overview](#2-architecture-overview)
3. [Technology Stack & Versions](#3-technology-stack--versions)
4. [Module & Package Structure](#4-module--package-structure)
5. [Architectural Decision Records (ADRs)](#5-architectural-decision-records-adrs)
6. [Domain Layer Design](#6-domain-layer-design)
7. [Data Layer Design](#7-data-layer-design)
8. [Alarm & Wake Subsystem](#8-alarm--wake-subsystem)
9. [Session Timer Subsystem](#9-session-timer-subsystem)
10. [Day Rollover, Streaks & Analytics Computation](#10-day-rollover-streaks--analytics-computation)
11. [Content Subsystem (Scripture, Declarations, TTS)](#11-content-subsystem-scripture-declarations-tts)
12. [Backup, Restore & Export Subsystem](#12-backup-restore--export-subsystem)
13. [UI Layer: Compose Architecture](#13-ui-layer-compose-architecture)
14. [Design System Implementation](#14-design-system-implementation)
15. [Navigation Design](#15-navigation-design)
16. [Notifications & Channels](#16-notifications--channels)
17. [Permissions Choreography](#17-permissions-choreography)
18. [Concurrency, Threading & State](#18-concurrency-threading--state)
19. [Error Handling & Resilience](#19-error-handling--resilience)
20. [Performance Engineering](#20-performance-engineering)
21. [Security Engineering](#21-security-engineering)
22. [Accessibility Implementation](#22-accessibility-implementation)
23. [Testing Strategy](#23-testing-strategy)
24. [Build, CI/CD & Release Engineering](#24-build-cicd--release-engineering)
25. [Observability & Diagnostics](#25-observability--diagnostics)
26. [Coding Standards & Conventions](#26-coding-standards--conventions)
27. [Delivery Plan Mapping & Estimates](#27-delivery-plan-mapping--estimates)
28. [Complete Project Folder & File Structure](#28-complete-project-folder--file-structure)
29. [Phased Execution Plan (First → Last)](#29-phased-execution-plan-first--last)
30. [Appendix A — Full Room Schema (DDL-level)](#30-appendix-a--full-room-schema-ddl-level)
31. [Appendix B — Backup JSON Schemas (v1/v2)](#31-appendix-b--backup-json-schemas-v1v2)
32. [Appendix C — Design Tokens](#32-appendix-c--design-tokens)
33. [Appendix D — Test Device & OEM Matrix](#33-appendix-d--test-device--oem-matrix)

---

## 1. Purpose & Scope

This document translates the PRD into an implementable engineering design. It fixes the architecture, module boundaries, schemas, subsystem designs (alarms, timer, rollover, backup), platform-compliance mechanics, and the quality/CI bar. Anything ambiguous in the PRD that requires an engineering decision is resolved here and recorded as an ADR (Section 5).

**In scope:** everything needed to build MVP (P0) and the structural seams for V1.1 (P1).
**Out of scope:** visual design specs beyond tokens (the prototype + design gallery is the parity contract), copywriting, store listing assets.

**Hard constraints inherited from the PRD:**

- **C1 — Offline-only:** the manifest MUST NOT declare `android.permission.INTERNET` (NFR-03/09, verified by a CI manifest check).
- **C2 — Zero third-party runtime SDKs** beyond AndroidX / Kotlin / JetBrains libraries (SP-05).
- **C3 — Alarm reliability is the top engineering priority** (NFR-02): every design trade-off resolves in favor of the 3:00 AM alarm firing.
- **C4 — No data loss:** transactional writes, tested migrations, atomic restore (NFR-07).

---

## 2. Architecture Overview

### 2.1 Style

**MVVM + Unidirectional Data Flow (UDF)** over a pragmatic clean-architecture layering. Three layers with strict, compiler-enforced (module-graph) dependencies:

```
┌────────────────────────────────────────────────────────────┐
│  UI (Compose)      :feature:*  — screens, ViewModels        │
│    depends on ↓                                              │
│  Domain (pure JVM) :core:domain — models, use-cases,         │
│                     calculators, repository INTERFACES       │
│    implemented by ↓                                          │
│  Data              :core:data  — Room, DataStore, backup     │
│                    :core:alarm — AlarmManager, FGS, receivers│
└────────────────────────────────────────────────────────────┘
```

- **UI** renders `UiState` (immutable data class) from a `StateFlow`, sends `UiEvent`s to the ViewModel. No business logic in composables.
- **Domain** is a pure Kotlin/JVM module: no Android imports. All business rules that the PRD makes testable (streaks, rollover, playlist resolution, alarm-time math) live here as small, deterministic classes.
- **Data** implements domain repository interfaces. Room is the single source of truth for user data; DataStore for preferences; system services (AlarmManager, TTS) are wrapped behind interfaces so domain/UI never touch platform APIs directly.

### 2.2 Runtime Topology

```
                 ┌───────────────────────────────────────────────┐
                 │                  Process                       │
  MainActivity ──┤  NavHost → feature screens → ViewModels        │
  (single act.)  │        ↓ StateFlow / events ↑                  │
                 │  Repositories ── Room (SQLite) ── DataStore    │
                 └───────┬───────────────┬───────────────────────┘
                         │               │
        AlarmActivity    │               │   TimerService (FGS)
        (showWhenLocked, │               │   ongoing notification
         turnScreenOn) ◄─┤ full-screen   │◄─ start/pause/complete
                         │ intent        │
   AlarmReceiver ◄── AlarmManager.setAlarmClock (one-shot, self-rescheduling)
   BootReceiver / TimeChangeReceiver → AlarmRescheduler
   WorkManager: MidnightRolloverWorker, DailySummaryWorker, BackupReminderWorker
```

Two activities only: `MainActivity` (entire app, Compose) and `AlarmActivity` (minimal, lock-screen alarm UI — kept separate so it can launch fast from a full-screen intent with `showWhenLocked` + `turnScreenOn` without inflating the whole app graph).

---

## 3. Technology Stack & Versions

Versions are floors at time of writing; managed via Gradle version catalog (`gradle/libs.versions.toml`) and bumped by Renovate-style PRs (Section 24).

| Concern | Library | Version floor | Notes |
|---|---|---|---|
| Language | Kotlin (K2) | 2.2.x | JVM target 17 |
| Build | AGP | 8.13.x | SDK: `minSdk 26`, `targetSdk 36`, `compileSdk 36` |
| UI | Compose BOM | 2026.06.x | Material 3, `androidx.compose.material3` |
| Navigation | `androidx.navigation:navigation-compose` | 2.9.x | Type-safe routes (kotlinx.serialization) |
| Lifecycle | `lifecycle-runtime-compose`, `lifecycle-viewmodel-compose` | 2.9.x | `collectAsStateWithLifecycle` |
| DI | Hilt | 2.57.x | + `androidx.hilt:hilt-navigation-compose`, `hilt-work` |
| DB | Room | 2.8.x | KSP; FTS5 for journal search (P1) |
| Prefs | DataStore (Preferences) | 1.1.x | |
| Background | WorkManager | 2.10.x | Hilt worker factory |
| Serialization | kotlinx.serialization-json | 1.9.x | backup codec, nav args |
| Datetime | `java.time` via core library desugaring | — | ADR-07 |
| Splash | `androidx.core:core-splashscreen` | 1.2.x | |
| Biometric (P1) | `androidx.biometric` | 1.2.x | app lock |
| Static analysis | detekt, ktlint (spotless) | latest | CI-gated |
| Testing | JUnit5, Turbine, MockK (interfaces only), Robolectric, Compose UI test, Maestro | latest | Section 23 |
| Perf | Macrobenchmark, Baseline Profiles (`profileinstaller`) | latest | Section 20 |
| Leak (debug) | LeakCanary | latest | debug builds only |

Explicitly **not** used: Firebase (any), Retrofit/OkHttp (no network), Coil/Glide (no remote images; all assets local vectors/emoji), RxJava, Paging3 is allowed if journal lists need it (NFR-05) — start with lazy lists + Room `LIMIT/OFFSET` Flow queries, adopt Paging3 only if benchmarks demand.

---

## 4. Module & Package Structure

Gradle modules (matches PRD §10.2, expanded):

```
:app                        // MainActivity, AlarmActivity, NavHost, Hilt app,
                            // manifest, receivers registration, proguard
:core:designsystem          // MbTheme, tokens, typography, shared components
:core:ui                    // screen-agnostic UI utils (SnackbarController,
                            // LifecycleEffects, permission helpers, previews)
:core:domain                // PURE JVM: models, use-cases, calculators,
                            // repository + clock + scheduler interfaces
:core:data                  // Room db+DAOs+entities, DataStore, repositories,
                            // seed pipeline, backup codec, export writers
:core:alarm                 // AlarmScheduler impl, receivers, AlarmActivity UI
                            // contract, TimerService, notification builders
:core:testing               // test fixtures, fake repositories, MainDispatcherRule
:feature:onboarding
:feature:home
:feature:sessions           // list + phase tabs
:feature:timer              // ActiveSession screen (binds to TimerService state)
:feature:scripture
:feature:declarations       // library + readout
:feature:journal            // list + editor
:feature:planner
:feature:analytics
:feature:settings           // + alarms setup screen (owned here; navigates from Settings & Home)
:baselineprofile            // macrobenchmark + profile generator
```

**Dependency rules (enforced by module graph + a Gradle convention-plugin check):**

- `:feature:*` → `:core:designsystem`, `:core:ui`, `:core:domain` only. **Never** `:core:data` or `:core:alarm` directly (Hilt provides domain interfaces).
- `:core:data`, `:core:alarm` → `:core:domain`.
- `:core:domain` → nothing but Kotlin stdlib + kotlinx (no `android.*`).
- No `:feature:*` → `:feature:*` dependencies; cross-feature navigation goes through the nav graph in `:app`.

Package convention inside a feature: `com.morningblueprint.feature.journal.{ui,vm}` with `JournalListScreen.kt`, `JournalListViewModel.kt`, `JournalListUiState.kt`.

Convention plugins in `build-logic/`: `mb.android.library`, `mb.android.feature`, `mb.android.compose`, `mb.jvm.library`, `mb.hilt` — every module applies exactly one base plugin, keeping build scripts ≤ 10 lines.

---

## 5. Architectural Decision Records (ADRs)

Each ADR: context → decision → consequences. Stored in-repo under `docs/adr/` post-M0; summarized here.

**ADR-01 — Single-activity Compose app + separate `AlarmActivity`.**
Full-screen-intent alarms must render < 500 ms from a cold process on a locked device. Inflating the full nav graph risks jank and lock-screen policy friction. `AlarmActivity` is a leaf activity (`excludeFromRecents`, `showWhenLocked`, `turnScreenOn`, `launchMode=singleInstance`) with one Compose screen and zero feature-module deps. *Consequence:* alarm UI components duplicated at the design-token level only.

**ADR-02 — `AlarmManager.setAlarmClock` with one-shot self-rescheduling (no repeating alarms).**
`setAlarmClock` is the only API guaranteed to fire through Doze without the app holding the (unrequestable-by-policy-risk) exemptions; it also surfaces the OS alarm icon and `getNextAlarmClock()` interop. Each fired alarm's receiver schedules that session's next occurrence (+24 h, recomputed from wall clock, not added naively — DST-safe via `ZonedDateTime`). *Consequence:* a missed re-schedule is the top data-integrity risk → mitigated by an idempotent `AlarmRescheduler.syncAll()` invoked from 6 triggers (Section 8.4).

**ADR-03 — Timer truth = persisted target timestamps, not ticks (PRD D3).**
`TimerService` persists `{sessionId, endsAtElapsedRealtime, endsAtWallClock, pausedRemainingSec?}` to a Room singleton row on every state change. UI derives remaining time each frame-second from `SystemClock.elapsedRealtime()`. Reboot recovery compares wall clock (elapsedRealtime resets). *Consequence:* zero drift, survives process death for free; two clocks must be reconciled on restore (wall clock wins after reboot).

**ADR-04 — Foreground service type `specialUse` for the session timer.**
Android 14+ requires typed FGS. The countdown is not media, not health (no `BODY_SENSORS`), not shortService (runs up to 30 min). `FOREGROUND_SERVICE_SPECIAL_USE` with `PROPERTY_SPECIAL_USE_FGS_SUBTYPE = "session_countdown_timer"` and a Play declaration is the honest fit. *Fallback plan:* if Play review rejects, degrade to exact-alarm-at-end + resilient notification updates via `AlarmManager` ticks each minute (design isolated behind `TimerEngine` interface so the swap is contained).

**ADR-05 — Room is the single source of truth; DataStore only for scalar prefs.**
Anything queryable/relational (completions, entries, alarms, bookmarks) is Room. DataStore holds enum/bool/string prefs (theme, translation, discipline…) exposed as a single `UserPrefs` Flow. *Consequence:* backup codec reads both; restore writes both inside one logical transaction (Room `withTransaction` + DataStore batch `updateData`, ordered Room-first with a journal flag to recover a half-applied restore — Section 12.3).

**ADR-06 — Seed content as versioned JSON assets + `seedVersion` reconciliation (PRD D4).**
`assets/seed/{sessions,declarations,scriptures,prompts}.json` with an integer `seedVersion` in DataStore. On app start (and after restore), `SeedReconciler` upserts rows where `isCustom = 0` and `seedVersion` increased; never touches user-flagged rows. *Consequence:* content fixes ship in app updates without migrations.

**ADR-07 — `java.time` + core library desugaring; dates persisted as ISO-8601 TEXT.**
`LocalDate` for product-day keys, `Instant` for timestamps, `ZoneId` captured at write for audit only. All "today" computations go through an injected `Clock` interface (domain) → trivially testable rollover/DST cases. Relative labels ("Today"/"Yesterday") are render-time only (fixes prototype G-05 class).

**ADR-08 — Type-safe Navigation Compose with serializable route objects.**
Routes defined as `@Serializable` data classes/objects in `:core:ui` (`nav/Routes.kt`); features expose `NavGraphBuilder.journalGraph(...)` extension functions; `:app` assembles them. Deep links (`mb://session/{id}` etc.) declared on the composable destinations.

**ADR-09 — No Paging3 / no Coil at MVP.** Journal list uses Room-Flow + `LazyColumn` keys; measure at 10k synthetic entries in a macrobenchmark; adopt Paging3 only on failure (NFR-05). No image loading exists (emoji + vector icons only).

**ADR-10 — Strings-first theming, brand palette only (no dynamic color).** Matches PRD §14; `MbTheme(darkTheme, motionReduced)` wraps `MaterialTheme` with extended `MbColors` (phase colors, gold/violet) provided via `CompositionLocal`.

**ADR-11 — MockK only at boundaries; fakes preferred.** `:core:testing` ships hand-written fakes (`FakeCompletionRepository`, `FixedClock`, `RecordingAlarmScheduler`) — deterministic, refactor-safe tests; MockK reserved for platform seams (TTS engine, SAF).

**ADR-12 — Kotlin-only, no KAPT.** All annotation processing via KSP (Room, Hilt ≥ 2.57 KSP mode). Build-perf and K2 compatibility.

---

## 6. Domain Layer Design

### 6.1 Models (pure Kotlin, immutable)

```kotlin
data class Session(
    val id: SessionId,            // value class over Int (1..8)
    val phase: Phase,             // ALIGNMENT, DECLARATION, SHARPENING
    val title: String,
    val emoji: String,
    val defaultStart: LocalTime,  // 03:00 …
    val duration: Duration,
    val description: String,
    val prompt: String,
)

enum class Outcome { COMPLETED, SKIPPED }

data class SessionCompletion(
    val date: LocalDate, val sessionId: SessionId,
    val outcome: Outcome, val completedAt: Instant, val elapsed: Duration,
)

data class DayProgress(val date: LocalDate, val completed: Set<SessionId>,
                       val skipped: Set<SessionId>, val enabled: Set<SessionId>)

data class StreakState(val current: Int, val best: Int, val atRisk: Boolean)

data class Declaration(val id: Long, val category: DeclarationCategory,
                       val text: String, val reference: String?,
                       val isCustom: Boolean, val isActive: Boolean)

data class JournalEntry(val id: Long, val sessionId: SessionId,
                        val body: String, val createdAt: Instant,
                        val updatedAt: Instant, val starred: Boolean)

data class BigThree(val date: LocalDate, val slots: List<TaskSlot>) // size == 3 invariant

data class UserPrefs(val theme: ThemeMode, val translation: Translation,
                     val vibration: VibrationPattern, val phaseAlerts: Boolean,
                     val disciplineMode: Boolean, val displayName: String?,
                     val keepScreenOn: Boolean, val scheduleShiftMin: Int)
```

### 6.2 Repository Interfaces (implemented in `:core:data` / `:core:alarm`)

`SessionRepository`, `CompletionRepository`, `JournalRepository`, `DeclarationRepository`, `ScriptureRepository`, `PlannerRepository`, `AlarmConfigRepository`, `PrefsRepository`, `BackupRepository`, `TimerStateRepository` — all Flow-first reads, `suspend` writes.

Platform seams as domain interfaces: `AlarmScheduler`, `TimerEngine`, `Speech` (TTS), `HapticsController`, `Clock` (`fun now(): Instant; fun today(): LocalDate; fun zone(): ZoneId`).

### 6.3 Use-Cases (one verb each; constructor-injected; `operator fun invoke`)

Business-critical calculators (heaviest unit-test targets, FR-ANL, FR-TRK):

```kotlin
class StreakCalculator {
    /** PRD §6.2: counted day = ≥1 COMPLETED; today pending ≠ broken (atRisk). */
    fun calculate(countedDays: SortedSet<LocalDate>, today: LocalDate): StreakState
}
class DayKeyResolver(clock: Clock) { fun today(): LocalDate }          // tz-safe (FR-TRK-06)
class NextAlarmTimeCalculator {
    /** next wall-clock occurrence of session start (+scheduleShift), DST-safe. */
    fun next(session: Session, prefs: UserPrefs, from: ZonedDateTime): ZonedDateTime
}
class ReadoutPlaylistResolver {
    /** FR-CNT-06: resolved ONCE on entry; active set else full library. */
    fun resolve(all: List<Declaration>): List<Declaration>
}
class DailyVerseSelector {
    /** FR-CNT-01: deterministic by (epochDay mod librarySize) per translation. */
    fun verseFor(date: LocalDate, library: List<Scripture>): Scripture
}
class HeatmapBucketer { fun bucket(sessionsCompleted: Int): Int /* 0..3 */ }
class PhaseRateCalculator { /* trailing-30-day rate per phase, FR-ANL */ }
```

Orchestrating use-cases: `CompleteSessionUseCase` (writes completion, updates daily summary, triggers streak recompute, returns next-session suggestion), `StartSessionUseCase` (enforces single-timer invariant FR-TRK-03), `ToggleAlarmUseCase` (persist + schedule atomically, FR-ALM-01), `RestoreBackupUseCase`, `RolloverUseCase`.

**Invariants enforced in domain (not UI):**
- I1: at most one running timer (`StartSessionUseCase` rejects with `TimerBusy` result).
- I2: `(date, sessionId)` completion upsert — re-completing replaces, never duplicates.
- I3: `BigThree.slots.size == 3` always (repository backfills).
- I4: readout index ∈ playlist bounds by construction (playlist immutable during readout).

---

## 7. Data Layer Design

### 7.1 Room Database

`MbDatabase : RoomDatabase` — schema in Appendix A. Key implementation points:

- **Version 1** at MVP; `exportSchema = true`, schemas committed to `:core:data/schemas/` (migration tests diff against them).
- All date keys `TEXT` ISO-8601 (`yyyy-MM-dd`); instants `TEXT` ISO-8601 UTC. Converters in one `MbTypeConverters` object.
- `session_completions` has `UNIQUE(date, sessionId)` + `OnConflictStrategy.REPLACE` (invariant I2).
- `daily_summaries` is a materialized table updated inside the same `withTransaction` as completion writes (never a trigger — explicit Kotlin code, testable) and rebuilt idempotently by `RolloverUseCase` if a consistency check fails.
- WAL mode (Room default), `setQueryCoroutineContext(Dispatchers.IO limitedParallelism(4))`.
- DAOs return `Flow<…>` for reads; suspend for writes; **no** `LiveData` anywhere.

### 7.2 DataStore

Single `PreferencesDataStore("user_prefs")`; `PrefsRepositoryImpl` maps raw prefs → `UserPrefs` Flow with defaults matching PRD Appendix A.5. All enum reads defensive (`enumValueOfOrDefault`).

### 7.3 Seed Pipeline (ADR-06)

```
AppStartup (androidx.startup or Application.onCreate coroutine):
  seedVersion(DataStore) < BuildConfig.SEED_VERSION ?
    → SeedReconciler.run():
        parse assets/seed/*.json (kotlinx.serialization, fail-fast in debug,
        fall back to last-good rows in release + log)
        upsert sessions (always), scriptures (always),
        declarations WHERE isCustom = 0 (match by seed key, preserve isActive)
        write new seedVersion
```

Seed JSON carries stable `seedKey` strings so future reordering/renames don't duplicate rows.

### 7.4 Repositories

Thin, boring, transaction-owning. Example contract-level rules:

- `CompletionRepositoryImpl.record(...)`: `withTransaction { upsert completion; recompute daily_summaries[date]; }`
- `JournalRepositoryImpl.save(...)`: trims body, rejects blank (`SaveResult.EmptyBody` — FR-JRN-03 lives here so every entry point gets it), caps 20k chars, stamps `updatedAt`.
- `PlannerRepositoryImpl.forDate(date)`: emits existing 3 slots or lazily creates blanks (invariant I3); yesterday's rows untouched (P1 history).

---

## 8. Alarm & Wake Subsystem (`:core:alarm`) — FR-ALM-01…09

The most safety-critical subsystem. Design goal: **an enabled alarm always has exactly one pending `PendingIntent`, pointed at its next occurrence.**

### 8.1 Components

```
AlarmScheduler (domain iface) ── AlarmSchedulerImpl
    schedule(sessionId, at: ZonedDateTime)   // setAlarmClock + info PI
    cancel(sessionId)
    canScheduleExact(): Boolean              // gate + Settings deep-link helper
AlarmRescheduler                             // syncAll(): reconcile DB ↔ AlarmManager
AlarmReceiver (BroadcastReceiver, exported=false)
BootReceiver (BOOT_COMPLETED, LOCKED_BOOT_COMPLETED → directBootAware? see 8.6)
TimeChangeReceiver (TIME_SET, TIMEZONE_CHANGED, DATE_CHANGED)
AlarmActivity (+ AlarmRingViewModel)
AlarmRinger                                  // MediaPlayer(USAGE_ALARM) + Vibrator, 5-min cap
SnoozePolicy                                 // 9 min, max 3; disabled by disciplineMode
MissedAlarmHandler                           // FR-ALM-07 notification
```

### 8.2 Scheduling Mechanics

- One `PendingIntent` per session: `requestCode = sessionId`, `FLAG_IMMUTABLE or FLAG_UPDATE_CURRENT`, explicit intent to `AlarmReceiver` with `EXTRA_SESSION_ID` + `EXTRA_SCHEDULED_AT` (epoch ms, for lateness telemetry & stale-fire rejection).
- `setAlarmClock(AlarmClockInfo(triggerAt, showIntent→AlarmActivity), operationPI)`.
- Time math exclusively via `NextAlarmTimeCalculator` (`ZonedDateTime` + `zone rules`): "next 03:00 local" — under DST spring-forward a nonexistent local time resolves to the zone-offset-adjusted instant (`withEarlierOffsetAtOverlap` semantics documented in tests).

### 8.3 Fire Path (target: ring < 2 s from broadcast)

```
AlarmReceiver.onReceive:
  goAsync() → within 8s window:
    1. reject if stale (scheduledAt < now - 30 min → MissedAlarmHandler, skip ring)
    2. reschedule NEXT occurrence for this session (do this FIRST — C3)
    3. start AlarmRingerService (FGS, type specialUse) → sound + vibration
    4. post full-screen-intent notification (channel "alarms", CATEGORY_ALARM,
       fullScreenIntent → AlarmActivity, ongoing, actions per SnoozePolicy)
```

The ringer runs in a small FGS (not the receiver) so audio survives the broadcast window. `AlarmActivity` binds to it; Start/Snooze/Dismiss all route through the service (single state owner) then finish the activity.

- **Start Session** → stop ringer → `MainActivity` deep link `mb://session/{id}` with `FLAG_ACTIVITY_NEW_TASK` (arms timer via `StartSessionUseCase`).
- **Snooze** → stop ringer → schedule one-shot +9 min (same PI namespace with snooze flag), decrement budget (max 3, FR-ALM-06). Hidden entirely when `disciplineMode` (FR-ALM-09).
- **Dismiss** — normal: button; discipline: 2 s hold-to-dismiss (`Modifier.pointerInput` progress ring) **plus** an accessibility custom action equivalent (A11Y-06).
- **Unattended 5 min** → auto-stop ring, `MissedAlarmHandler` posts "You missed Thanksgiving (3:00 AM)" notification (FR-ALM-07); no auto-snooze.

### 8.4 Reconciliation — `AlarmRescheduler.syncAll()`

Idempotent: reads enabled `alarm_configs`, computes next occurrence per session, calls `schedule` (PI `UPDATE_CURRENT` makes it safe), cancels PIs for disabled sessions. Triggered from:

1. `BOOT_COMPLETED` (FR-ALM-05)
2. `TIME_SET` / `TIMEZONE_CHANGED` / `DATE_CHANGED`
3. `MY_PACKAGE_REPLACED` (app update)
4. App foreground (cheap safety net, debounced 1/hour)
5. After restore-from-backup
6. After exact-alarm permission grant (`ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED` receiver)

### 8.5 Exact-Alarm Permission Handling

`canScheduleExactAlarms()` gate; if false: Alarms screen shows a warning chip + one-tap `ACTION_REQUEST_SCHEDULE_EXACT_ALARM` intent (FR-ALM UX in PRD E1-S2). Because the app is a bona fide alarm app we additionally declare `USE_EXACT_ALARM` (no user toggle, Play policy: alarm-app use case — Play declaration text kept in `docs/play/declarations.md`). Fallback while unpermitted: `setWindow` (±10 min) + persistent warning (PRD §13).

### 8.6 Direct Boot

Alarms must survive "restarted but never unlocked." `:core:alarm` receivers are `directBootAware`; `AlarmRescheduler` in direct-boot context reads a tiny **device-protected-storage** copy of the alarm table (session id → next fire time, mirrored on every schedule change). Full DB remains credential-encrypted. This is the only device-protected data.

### 8.7 Ringer Audio

Bundled alarm sound (`res/raw/mb_alarm.ogg`, ≤ 200 KB, gentle-build loop) + system-alarm-tone user choice (P1). `AudioAttributes USAGE_ALARM` → alarm stream, DND-exempt (FR-ALM-02/08). Volume ramps 0→100 % over 20 s (configurable later). Vibration via `VibratorManager` waveform matching the "calm" pattern; respects `vibration` pref except the alarm itself always vibrates if the ringer volume is 0.

---

## 9. Session Timer Subsystem — FR-TRK-03…05

### 9.1 `TimerEngine` (domain interface) / `TimerService` (impl, FGS `specialUse`, ADR-04)

State machine (single `MutableStateFlow<TimerState>` in the service, mirrored to Room `timer_state` on each transition):

```
IDLE ── start(sessionId) ──► RUNNING {sessionId, endsAtElapsed, endsAtWall}
RUNNING ── pause ──► PAUSED {remaining}          RUNNING ── tick(remaining==0) ──► FINISHED
PAUSED ── resume ──► RUNNING (recomputed ends)   ANY ── complete/stop ──► IDLE (+record)
FINISHED ── confirm ──► IDLE (+record COMPLETED) // FR-TRK-05: chime+haptic on entry
```

- **Tick source:** a coroutine `while(isActive) { emit; delay(1_000 - drift) }` aligned to `elapsedRealtime` — display only. Truth is `endsAt` (ADR-03). Additionally an exact `AlarmManager` one-shot at `endsAt` guarantees FINISHED fires even if the service is frozen (Android 14 FGS freezing) — the alarm-path and tick-path converge on an idempotent `onFinished()`.
- **Notification:** ongoing, channel `timer` (LOW importance, silent), remaining time via `setUsesChronometer`/countdown style, actions Pause/Resume + Complete (FR-TRK-03). Tapping opens `mb://session/{id}`.
- **Recovery:** `Application` start + `MainActivity` resume check `timer_state`: RUNNING with `endsAtWall` in future → restart service & resubscribe UI; in past → synthesize FINISHED (offer confirm dialog: "Your Scripture Meditation timer ended while the app was closed"). After reboot only `endsAtWall` is meaningful (elapsedRealtime reset) — documented in `TimerRecovery` tests.
- **Single-timer invariant (I1):** service rejects `start` when non-IDLE; UI shows "End current session?" dialog.
- **Finish signal:** chime (`res/raw/mb_chime.ogg`, `USAGE_NOTIFICATION_EVENT` — respects, not bypasses, DND), haptic per pref, heads-up notification if app backgrounded.
- **Keep-screen-on:** `ActiveSessionScreen` sets `FLAG_KEEP_SCREEN_ON` while RUNNING iff pref (default: only while charging — read `BatteryManager`).

### 9.2 UI Binding

`:feature:timer`'s `ActiveSessionViewModel` collects `TimerEngine.state` + session metadata → `TimerUiState(remaining, progress, isRunning, session, phase)`. The ring animates via `animateFloatAsState` on progress (1 s linear), numerals recompose per second — isolated in a `TimerReadout` composable so only that node recomposes (Section 20).

---

## 10. Day Rollover, Streaks & Analytics Computation — FR-TRK-06, FR-ANL

### 10.1 Rollover (`RolloverUseCase`, FR-TRK-06)

Triggers: (a) WorkManager periodic worker with a **one-shot exact re-arm at next local midnight** (periodic alone drifts), (b) app-foreground check `lastSeenDate != today`, (c) `TIMEZONE_CHANGED`/`TIME_SET`.

Actions (idempotent, keyed by date):
1. Finalize yesterday's `daily_summaries` row (counted = completions ≥ 1).
2. Recompute `StreakState` → cache in DataStore for fast Home render (source of truth remains derivable).
3. Big Three: ensure today's 3 blank slots exist (yesterday preserved).
4. Emit `DayChanged` on an app-scoped `SharedFlow` — Home/Sessions ViewModels refresh.

Timezone change re-anchors `today()` only; historical rows keep their stored dates (no rewriting — PRD E3-S2 AC2). Double-count impossible: completion keys are `(date, sessionId)` unique.

### 10.2 Analytics Queries (all SQL, no in-memory scans of full history)

- Streak: `SELECT date FROM daily_summaries WHERE counted=1 ORDER BY date DESC LIMIT 400` → `StreakCalculator` (bounded window; best-streak maintained incrementally in DataStore, recomputed fully on restore).
- Totals: `SUM` over `daily_summaries` (sessions, minutes).
- Phase rates: join completions×sessions over trailing 30 days ÷ (enabled×days) — `PhaseRateCalculator` gets raw counts.
- Heatmap: last 35 `daily_summaries` bucketed via `HeatmapBucketer` (0 / 1–2 / 3–5 / 6–8).
- Weekly summary: current week (Sunday start, PRD Q8) aggregates.
- Empty states: every query result has a `isEmpty` UI branch (PRD E7-S1 AC6) — no invented numbers.

---

## 11. Content Subsystem (Scripture, Declarations, TTS) — FR-CNT-01…06

### 11.1 Scripture

- Library bundled per licensed translation (`assets/seed/scriptures.json`: `[{seedKey, ref, themeTag, texts:{KJV:"…", WEB:"…"}}]`). Only translations present in the bundle appear in the switcher (FR-CNT-02; honest-labeling fix for prototype G-06). Commercial translations (NIV/ESV/NKJV) plug into the same map when/if licensed (PRD Q1) — no code change, new seed version.
- `DailyVerseSelector`: `library[(epochDay + rotationSalt) mod size]` — deterministic, same verse all day, no repeats until cycle completes (FR-CNT-01). `rotationSalt` fixed constant (not random — reproducibility).
- Bookmarks: `bookmarks(scriptureId, createdAt)`; bookmark list = filter chip on Scripture screen (FR-CNT-03).
- Meditation prompts: per-verse `promptSetKey` → pools in `prompts.json`; fallback to the generic 3 (PRD G-17).

### 11.2 Declarations & Readout

- Seed 6 + custom CRUD (P1: `isCustom=1`, editable/deletable with undo snackbar).
- **Readout session object:** on entering readout, `ReadoutViewModel` calls `ReadoutPlaylistResolver.resolve()` once and stores `List<Declaration>` + index in `SavedStateHandle`. Toggling actives elsewhere cannot mutate an in-flight readout (FR-CNT-06 / G-11 fix). Next on last item → Done (pops).

### 11.3 TTS (`Speech` interface → `AndroidSpeech` impl)

- `TextToSpeech` initialized lazily on first readout entry (init ~200–800 ms → show "preparing voice…" shimmer state), released in `onCleared`/exit.
- Params: rate `0.86f`, pitch `0.95f` (FR-CNT-05, prototype parity PR-06). `UtteranceProgressListener` → `SpeechState {IDLE, SPEAKING(utteranceId), ERROR}` StateFlow drives the speaking-bars animation.
- Audio focus: `AudioFocusRequest(GAIN_TRANSIENT_MAY_DUCK, USAGE_ASSISTANCE_*)`; abandon on stop/exit. Stop on navigation (mirrors prototype `stopSpeech` on every nav).
- Unavailable engine (`status != SUCCESS` or missing language data): Speak button → inline error + link to TTS settings; visual readout unaffected (E5-S2 AC4).
- **A11Y-07:** while TTS speaks, the card's text is marked `invisibleToUser=false` but live-region OFF, and TalkBack focus is placed on the transport controls to avoid double-speaking.

---

## 12. Backup, Restore & Export Subsystem — FR-DAT-01…04

### 12.1 Formats

Appendix B defines both schemas. v2 (kotlinx.serialization, `explicitNulls=false`, `ignoreUnknownKeys=true`) is a strict superset of the prototype's v1; the decoder sniffs `version`.

### 12.2 Backup (`BackupRepository.export()`)

SAF `CREATE_DOCUMENT` (`application/json`, suggested name `morning-blueprint-backup-YYYY-MM-DD.json`) or share-sheet via `FileProvider` temp file (deleted after send). Content assembled from Room + DataStore in a read transaction; excluded: `timer_state`, `daily_summaries` (derivable — rebuilt on restore). Backup reminder: WorkManager monthly + after-50-entries nudge (PRD R7), notification channel `reminders` (DEFAULT importance).

### 12.3 Restore (`RestoreBackupUseCase`) — hostile-input pipeline (SP-02)

```
1. SAF OPEN_DOCUMENT → size check ≤ 5 MB (stream, don't load first)
2. Parse JSON → version sniff → V1Decoder | V2Decoder
3. SANITIZE (pure function, heavily unit-tested):
   enum whitelists (theme/translation/categories/outcomes), length caps
   (body 20k, task 500, name 60), count caps (journal 10k, completions 100k),
   date parse-or-drop, id re-mint on collision, unknown fields dropped
4. Confirmation dialog (destructive) → auto pre-restore safety backup to
   app-private files/ (rotating, keep 3)
5. APPLY atomically:
   Room withTransaction { clear user tables; insert sanitized }
   → DataStore updateData { prefs }        // ordered; recovery flag in DataStore:
   → restoreInFlight=false                 // if true at next start: re-apply prefs step
6. Post: SeedReconciler.run(); rebuild daily_summaries; AlarmRescheduler.syncAll();
   recompute streak cache
```

v1 mapping: `journal[].preview → body`; relative dates ("Today"/"Yesterday"/"N days ago") → best-effort `createdAt` from import date minus offset, else import-date; alarms map by session id; `bookmarked` ids remap via seedKey table.

### 12.4 Journal Export (FR-DAT-03)

- **PDF:** `android.graphics.pdf.PdfDocument`, A4, paginated `StaticLayout` rendering (serif for body per design), header = session + timestamp, footer = page n. Text drawn as text (no WebView — SP-06). Streamed to SAF `CREATE_DOCUMENT` (`application/pdf`).
- **Markdown:** `# Morning Blueprint Journal` → `## {date} — {session}` sections; same SAF/share paths.
- Export respects the current filter (all / phase / starred).
- Filenames sanitized (`[A-Za-z0-9-_ ]`, SP-06).

---

## 13. UI Layer: Compose Architecture

### 13.1 Screen Contract (every feature identical)

```kotlin
@HiltViewModel class XViewModel @Inject constructor(...) : ViewModel() {
    val uiState: StateFlow<XUiState>            // stateIn(WhileSubscribed(5_000))
    fun onEvent(event: XEvent)                  // sealed interface XEvent
    val effects: Flow<XEffect>                  // Channel: one-shot nav/snackbar
}

@Composable fun XRoute(vm: XViewModel = hiltViewModel(), onNavigate: (Route) -> Unit) {
    val state by vm.uiState.collectAsStateWithLifecycle()
    // collect effects in LaunchedEffect
    XScreen(state, vm::onEvent)                 // stateless, preview-able
}
```

Rules:
- `UiState` is a single immutable data class per screen; sub-models stable (`@Immutable` where needed); lists are `kotlinx.collections.immutable.PersistentList` for skippability.
- One-shot effects (navigate, snackbar, toast-parity messages) via `Channel(BUFFERED)` — never in state.
- No repository/use-case calls from composables; no `Context` in ViewModels (inject wrapped seams).
- `SavedStateHandle` for: editor drafts (FR E6-S1 AC5, mirrored to DataStore draft on 2 s debounce), readout playlist+index, active phase tab, nav args.
- Every stateless screen has `@PreviewLightDark` + font-scale 2.0 preview.

### 13.2 Snackbar/Toast Parity

Prototype toasts ("Session complete", "Your Big Three are committed", "Invalid backup file"…) map to a single app-scoped `SnackbarController` (`:core:ui`) rendered above the bottom bar with the prototype's pill styling; auto-dismiss 1.8 s; `role=status` semantics.

---

## 14. Design System Implementation (`:core:designsystem`)

- `MbTheme(themeMode, content)`: resolves dark/light/auto (auto = `isSystemInDarkTheme()`), sets `MaterialTheme(colorScheme, typography, shapes)` **plus** `LocalMbColors` (extended palette: phase1/2/3 ± dim/border variants, gold/violet gradients) and `LocalMotion` (reduced-motion flag from `Settings.Global.ANIMATOR_DURATION_SCALE == 0` → all decorative `InfiniteTransition`s no-op; A11Y-05/PR-11).
- Tokens: Appendix C — single Kotlin file `MbTokens.kt` generated to match prototype CSS variables 1:1; the M0 "gallery" screen (debug build) renders every component next to a prototype screenshot for the parity contract (PRD R8).
- Typography: bundle **Cormorant Garamond** + **Outfit** (OFL, `res/font/`, `FontFamily` with weights 300–800); `MbType.displaySerif/timerSerif/statSerif/bodySans/…`. No downloadable fonts (C1).
- Core components (all stateless, tokens-only): `MbCard`, `MbChip`, `MbProgressRing` (Canvas arc, glow via `drawIntoCanvas` shadow layer, sweep animated), `MbToggle` (48 dp touch target wrapping 44×26 visual — A11Y-04), `MbPrimaryButton` (gold→violet `Brush.linearGradient`), `MbOutlineButton`, `MbTabRow`, `MbBottomBar`, `MbTopBar`, `MbStatusToast`, `MbHeatmap`, `MbSessionTicks`, `PressScale` modifier (`graphicsLayer scale .965` on pressed, spec-matching prototype `.press`).
- Edge-to-edge (`enableEdgeToEdge()`), `WindowInsets` handled at scaffold level; status-bar scrim per theme.

---

## 15. Navigation Design (ADR-08)

```kotlin
@Serializable sealed interface Route {
  @Serializable data object Home : Route
  @Serializable data class Sessions(val phase: Int = 1) : Route
  @Serializable data class ActiveSession(val sessionId: Int) : Route
  @Serializable data object Journal : Route
  @Serializable data class JournalEditor(val entryId: Long? = null,
                                          val prefillSessionId: Int? = null) : Route
  @Serializable data object Scripture : Route
  @Serializable data object Declarations : Route
  @Serializable data object Readout : Route
  @Serializable data object Planner : Route
  @Serializable data object Analytics : Route
  @Serializable data object Settings : Route
  @Serializable data object Alarms : Route
  @Serializable data object Onboarding : Route
}
```

- Five top-level destinations (Home, Sessions, Journal, Analytics, Settings) with `navigation` **saveState/restoreState** per tab (FR-SHL-01); bottom bar hidden on full-screen routes (`ActiveSession`, `Readout`, `Onboarding`) via route-class check (parity §2.2).
- Deep links: `mb://session/{sessionId}`, `mb://journal/{entryId}`, `mb://alarms` — declared on destinations; `AlarmActivity` and notifications use them exclusively (single entry path).
- Predictive back enabled (`android:enableOnBackInvokedCallback="true"`); guarded exits: running timer → confirm end; dirty editor → discard-draft dialog (`BackHandler`).
- Start destination logic in `:app`: `onboardingDone ? Home : Onboarding` (read synchronously from DataStore snapshot before `setContent` behind the splash-screen keep-on-screen condition — no flash).

---

## 16. Notifications & Channels

| Channel id | Name | Importance | Sound | Used by |
|---|---|---|---|---|
| `alarms` | Session Alarms | HIGH (MAX behavior via FSI + CATEGORY_ALARM) | alarm tone, `USAGE_ALARM` | AlarmReceiver/RingerService |
| `timer` | Active Session | LOW | silent | TimerService ongoing |
| `phase` | Phase Transitions (P1) | HIGH | short chime | Phase alert worker |
| `missed` | Missed Sessions | DEFAULT | default | MissedAlarmHandler |
| `reminders` | Backup & Streak Reminders | DEFAULT | default | Workers (opt-in) |

Channels created once at app start; never programmatically re-configured (user owns channel settings after creation). All notifications: `setShowWhen`, PendingIntents `FLAG_IMMUTABLE`, deep-link content intents, `BigTextStyle` where text may clip.

---

## 17. Permissions Choreography

Implementation of PRD §13 (states, storage, gating):

```
PermissionsCoordinator (:core:ui)
  notif: POST_NOTIFICATIONS  — request on onboarding slide 3; if denied once,
         rationale card; if permanently denied, Settings deep link chip on
         Home + Alarms (never modal-blocks)
  exactAlarm: canScheduleExactAlarms() checked at every alarm toggle; request
         via ACTION_REQUEST_SCHEDULE_EXACT_ALARM; state-change receiver → syncAll
  fullScreenIntent (API 34+): NotificationManager.canUseFullScreenIntent();
         if revoked → education card + ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT
  batteryOptimization: informational only — OEM guidance screen (per-OEM copy
         table), REQUEST_IGNORE_BATTERY_OPTIMIZATIONS deliberately NOT used
         (Play policy risk); "Alarm health check" diagnostic instead (§25)
  recordAudio (P1): just-in-time at first mic tap
```

Every gate exposes a `Flow<PermissionState>` so screens render degraded-mode chips reactively (E1-S2 AC2).

---

## 18. Concurrency, Threading & State

- **Dispatchers injected** (`MbDispatchers(io, default, main)`) — never hardcode `Dispatchers.*` outside the DI module; tests swap `StandardTestDispatcher`.
- Structured concurrency only: `viewModelScope` (UI), `ProcessLifecycleOwner`-scoped `AppScope` (Hilt `@Singleton CoroutineScope(SupervisorJob() + default)`) for fire-and-forget domain work (rollover on foreground, seed reconcile), WorkManager for deferrable, service scope for timer/ringer.
- No `GlobalScope`, no `runBlocking` outside `main()`-equivalent boot (a single documented DataStore snapshot read behind the splash condition, ≤ 5 ms budget) and tests.
- Room Flows are conflated by design; UI states composed with `combine` + `stateIn(WhileSubscribed(5s))` — screens cold-start from `Loading` skeletons ≤ 1 frame for cached queries.
- Broadcast receivers: `goAsync()` + `AppScope.launch` with an 8 s watchdog; all handlers idempotent (fires can duplicate on some OEMs).
- Single-writer disciplines: `timer_state` written only by `TimerService`; alarm PIs mutated only via `AlarmScheduler` (both asserted in debug with a lock-owner check).

---

## 19. Error Handling & Resilience

- **Result modeling:** domain returns sealed results (`SaveResult.EmptyBody`, `StartResult.TimerBusy`, `RestoreResult.Invalid(reason)`) — no exceptions across the domain boundary for expected failures; exceptions reserved for bugs (fail fast in debug via `StrictMode` + crash).
- **DB errors:** Room `SQLiteFullException` → user-facing "storage full" sheet with journal-export CTA; all writes retried once (transient I/O) then surfaced.
- **Restore:** any parse/validate failure → `Invalid`, zero writes (12.3 step order guarantees).
- **TTS/haptics/SAF absence:** every platform seam has a documented degraded behavior (Section 11.3, PRD ACs) — feature-detect, never crash.
- **Crash policy:** uncaught → `Thread.UncaughtExceptionHandler` writes a local breadcrumb ring buffer (Section 25) then rethrows to default handler. No auto-restart of activities into unknown state.
- **ANR avoidance:** no disk/DB on main (StrictMode `penaltyDeath` in debug), receivers under 8 s, `MainActivity.onCreate` measured budget 150 ms before first frame handoff.

---

## 20. Performance Engineering (NFR-01/04/05)

**Budgets (CI-enforced via Macrobenchmark on a Pixel-class managed device):**

| Metric | Budget | Test |
|---|---|---|
| Cold start → Home first frame | ≤ 2.0 s P50 / 3.0 s P95 | `startupBenchmark` (COLD, compilation `Partial(baselineProfile)`) |
| Warm start | ≤ 800 ms P50 | startup WARM |
| Journal scroll @10k entries | 0 frames > 32 ms per 5 s window P95 | `journalScrollBenchmark` (synthetic seed) |
| Timer screen steady-state | ≤ 1 recomposition/s beyond `TimerReadout` node | compose tracing assertion |
| APK size | ≤ 30 MB installed | CI size diff gate (±5 % alert) |
| Overnight idle battery | < 1 % attributable | manual matrix test per release (Batt. Historian) |

**Tactics:** Baseline Profiles (startup + top-3 journeys) via `:baselineprofile`; R8 full mode; `nonTransitiveRClass`; resource shrinking; fonts subset if needed; recomposition hygiene (immutable state, `key`ed lazy items, lambdas remembered, `derivedStateOf` for progress→ring); no object allocation in the per-second timer path; heatmap drawn in a single `Canvas`; startup work deferred (seed reconcile & alarm sync post-first-frame via `AppScope`, splash holds ≤ 400 ms on condition only for theme/onboarding snapshot).

---

## 21. Security Engineering (SP-01…06)

- **Manifest hard-lines (CI check `manifest-guard`):** no `INTERNET`, no `ACCESS_NETWORK_STATE`, `allowBackup` governed by `dataExtractionRules` (include Room DB + DataStore; exclude pre-restore safety backups), `exported=false` on all receivers/services except boot receiver (with permission-protected intent filters), `usesCleartextTraffic` irrelevant (no net) but pinned false.
- **Untrusted input:** the only external inputs are backup files (12.3 pipeline) and SAF-returned URIs (validated `content://` scheme, size-capped streaming reads, no path handling of user filenames beyond sanitize-on-write — SP-06).
- **Rendering safety:** Compose text APIs only — no `Html.fromHtml`, no WebView anywhere in the app (structurally eliminates prototype-era XSS-class concerns).
- **Recents privacy (P1):** optional `FLAG_SECURE` on journal/editor windows; app lock via `BiometricPrompt` (`DEVICE_CREDENTIAL | BIOMETRIC_WEAK` fallback) gating app open — timer/alarm surfaces exempt (alarm must never be locked out).
- **Logs:** release builds log warnings+ only; never log journal bodies, declaration text, or backup contents at any level (lint rule `NoSensitiveLogging` custom detector).
- **Supply chain:** dependency-review job (OSS Index/OSV scan), Gradle dependency-verification metadata committed, reproducible-ish builds (fixed timestamps), Play app signing with upload-key rotation runbook.

---

## 22. Accessibility Implementation (A11Y-01…07)

- Semantics pass per screen: `contentDescription` on icon-only buttons, `stateDescription` + `Role.Switch` on `MbToggle`, `Role.Tab` + `selected` on tabs, heading semantics on section labels, `liveRegion=Polite` on the snackbar host and timer milestone announcements (50 % / 25 % / 1 min — announced via `view.announceForAccessibility` equivalent `SemanticsProperties.LiveRegion` node updates, throttled).
- Touch targets: `minimumInteractiveComponentSize()` (48 dp) enforced by the design system components themselves — feature code cannot ship a small target (A11Y-04, fixes prototype's 28 px checks).
- Contrast: token pairs audited in `MbTokens` unit test with a WCAG contrast function — `txt3` combinations asserted decorative-only via an allowlist (A11Y-03).
- Font scale: all text in `sp`; layouts tested at 2.0 scale in screenshot tests; timer numerals scale down via `AutoSize`-style fit rather than truncate (A11Y-02).
- Discipline dismiss: `customActions += CustomAccessibilityAction("Dismiss alarm")` performing the dismissal without the 2 s hold (A11Y-06).
- Reduced motion: `LocalMotion.reduced` gates all `InfiniteTransition`/decorative animation (A11Y-05).
- CI: Compose a11y checks (`enableAccessibilityChecks()` in UI tests) + manual TalkBack script per milestone (test charter in `docs/qa/a11y.md`).

---

## 23. Testing Strategy (NFR-12)

### 23.1 Pyramid & Coverage Targets

| Layer | Tooling | Target |
|---|---|---|
| Domain unit (calculators, use-cases, sanitizer) | JUnit5 + fakes (+ property tests where noted) | ≥ 90 % line on `:core:domain`; ≥ 80 % overall domain+data |
| Data (DAOs, migrations, repos, backup codec) | Robolectric + Room in-memory + `MigrationTestHelper` | every DAO query; every migration N→N+1 + squash 1→latest |
| ViewModel | Turbine + `MainDispatcherRule` + fakes | every state transition & effect per screen |
| Compose UI | `createAndroidComposeRule`, semantics-based | 6 critical journeys (below) + component gallery screenshots (Roborazzi) light/dark/2.0-font |
| Instrumented integration | connected tests on emulator (API 26, 31, 34, 36) | alarm schedule/fire (with `adb shell cmd alarm` fast-forward where available), timer recovery, direct-boot smoke |
| E2E smoke | Maestro flows on Firebase-Test-Lab-equivalent local farm | install→onboard→alarm on→complete session→journal→backup/restore |

### 23.2 Named High-Value Suites

- `StreakCalculatorTest`: gaps, today-pending (atRisk), DST days, year boundaries, empty history, 400-day windows. **Property test:** streak never exceeds counted-days size; adding a completion never lowers the streak.
- `NextAlarmTimeCalculatorTest`: DST spring-forward (03:00 nonexistent), fall-back (03:00 twice), timezone hops, schedule shift, "now == fire time" edge.
- `RolloverUseCaseTest`: idempotency (run 5× same day == run 1×), tz change day-shift, summary rebuild consistency.
- `BackupSanitizerTest`: fuzz corpus (malformed JSON, huge strings, wrong enums, id collisions, v1 prototype exports **including a real file exported from the prototype** committed as a fixture), golden-file round-trip v2 export→restore == identity.
- `TimerRecoveryTest`: process-death mid-RUNNING, reboot (wall-clock elapsed), FINISHED-while-dead synthesis, pause→kill→resume.
- `AlarmReconciliationTest` (Robolectric `ShadowAlarmManager`): syncAll idempotency, enable/disable races, stale-fire rejection, snooze-budget exhaustion, discipline-mode surface.

### 23.3 Critical UI Journeys (Compose tests, block merge)

1. Onboarding → Home (first-run flags, permission stubs)
2. Enable alarm → verify scheduler recorded (fake) → toggle off → cancelled
3. Start session → pause/resume → complete → Home progress updates
4. Journal: create (empty rejected) → edit → delete → undo
5. Declarations: activate set → readout playlist fixed → TTS state transitions (fake Speech)
6. Backup → wipe → restore → data identical (repos compared)

### 23.4 Test Data & Fixtures

`:core:testing`: `FixedClock`, `seedFixtures()` (mirrors real seed), `syntheticJournal(n)`, prototype-v1 backup fixture, screenshot baseline images. Managed-device Gradle DSL for API matrix; flaky quarantine label with weekly triage.

---

## 24. Build, CI/CD & Release Engineering

### 24.1 Build Types & Flavors

No flavors. `debug` (LeakCanary, StrictMode, gallery screen, `.debug` suffix) / `benchmark` (release-like, profileable) / `release` (R8 full, resource shrink, signed by Play App Signing).

`SEED_VERSION` and version code/name from git: `versionName = tag`, `versionCode = CI build number`.

### 24.2 CI Pipeline (every PR; GitHub Actions or equivalent)

```
1. static: ktlint(spotless) + detekt + Android Lint (fatal on new issues)
   + manifest-guard (no INTERNET, exported audit) + module-graph rule check
2. unit: JVM tests (:core:*, :feature:* VMs) + coverage gate (Kover)
3. data: Robolectric DAO/migration/backup suites
4. ui: Compose tests + Roborazzi screenshot diff (fails on unapproved pixels)
5. build: assembleRelease + bundleRelease + APK-size gate
6. bench (nightly, not per-PR): macrobenchmarks on managed device;
   regression > 10 % fails the nightly and pages the on-call reviewer
7. security (weekly): OSV dependency scan, dependency-verification check
```

Merge to `main` requires: green 1–5, 1 code review, linear history (squash). `main` is always releasable.

### 24.3 Release Train

- Internal testing track on every `main` merge (automated).
- Closed beta at each PRD milestone (M1+ builds behind `beta` tag).
- GA: staged rollout 10 % → 25 % → 50 % → 100 % with halt criteria: crash-free < 99.5 %, ANR > 0.08 %, alarm-related 1-star review spike. Rollback = halt + hotfix (no unpublish).
- Play declarations bundle (`docs/play/`): exact-alarm use case, FSI use case, FGS `specialUse` subtype, Data Safety "no data collected" — re-reviewed at every `targetSdk` bump.

---

## 25. Observability & Diagnostics

Constraint C1 forbids remote telemetry. Diagnostics are **local, user-visible, and exportable by the user only**:

- **Breadcrumb ring buffer** (`files/diag/breadcrumbs.log`, 256 KB rotating): app lifecycle, alarm schedule/fire/lateness (target vs actual, ±ms), timer transitions, rollover runs, restore events. Never content — event names + ids only (Section 21 logging rule).
- **Alarm Health Check screen** (Settings → hidden behind version-tap ×5 in MVP, promoted if support burden demands): shows next scheduled PIs vs DB expectation, exact-alarm/FSI/notification permission states, OEM battery-manager detection heuristics, last 20 alarm fires with lateness — plus "Export diagnostics" (SAF, user-initiated share to support email).
- **Play Console vitals** (crashes/ANRs, aggregated by Google, no SDK needed) is the only off-device signal; release health reviewed weekly (PG-5).
- Debug builds: StrictMode (death), LeakCanary, Compose recomposition counts overlay toggle, database inspector friendly (no encryption).

---

## 26. Coding Standards & Conventions

- Kotlin official style + ktlint; detekt config committed (complexity caps: function 60 lines, cyclomatic 15 — pragmatic, reviewed exceptions via `@Suppress` + justification).
- Naming: `XxxScreen/XxxRoute/XxxViewModel/XxxUiState/XxxEvent/XxxEffect`; use-cases verb-first (`CompleteSessionUseCase`); DAOs `XxxDao`; one public class per file.
- Compose: stateless screens; modifiers first param default `Modifier`; slot APIs over booleans; no `Composable` calls in loops without `key`; previews colocated.
- Comments: constraints and platform-quirk rationale only (e.g., *why* reschedule-before-ring); no narration.
- Strings: all user-visible text in `strings.xml` from day 1 (NFR-11); no string concatenation for user text (plurals/format args).
- Git: trunk-based, conventional commits, PR template with "tested how" section; ADR required for any decision touching Sections 5/8/9/12.
- Definition of Done (per story): ACs demonstrably pass (test or recorded manual step), tests added at the right pyramid level, a11y semantics pass, screenshot baselines updated intentionally, no new lint/detekt debt, docs (ADR/README) updated.

---

## 27. Delivery Plan Mapping & Estimates

Engineering breakdown against PRD milestones (2 Android engineers; sizes: S ≤ 2 d, M ≤ 5 d, L ≤ 10 d):

| Milestone | Workstreams (owner-splittable) | Size |
|---|---|---|
| **M0** (wk 1–3) | Repo/CI/convention plugins (M) · design system + tokens + gallery (L) · Room schema + DAOs + seed pipeline (M) · nav shell + theming + settings skeleton (M) · onboarding + permission coordinator (M) | |
| **M1** (wk 4–7) | Alarm subsystem incl. direct boot + reconciliation (**L**, riskiest — start first) · AlarmActivity + ringer (M) · TimerService + recovery (L) · completion tracking + rollover (M) · Home/Sessions data-driven (M) · OEM matrix testing round 1 (M) | |
| **M2** (wk 8–10) | Scripture + rotation + bookmarks (M) · declarations + readout + TTS (M) · journal CRUD + drafts (M) · planner (S) · seed content expansion to ≥ 90 verses (content task, parallel) | |
| **M3** (wk 11–12) | analytics queries + screen (M) · backup/restore incl. v1 import + safety backup (L) · PDF/MD export (M) · empty states (S) | |
| **M4** (wk 13–14) | perf budgets + baseline profiles (M) · a11y audit fixes (M) · migration/restore test hardening (S) · beta + release eng (M) | |

Critical path: **Alarm subsystem → OEM validation** (start M1 day 1; everything else can flex around it). Second risk: FGS `specialUse` Play review (ADR-04 fallback keeps M1 unblocked).

---

## 28. Complete Project Folder & File Structure

The authoritative source tree. Names below are binding (Section 26 conventions); a file not listed here is either a sibling following the same pattern (e.g., additional components, additional DAOs) or requires reviewer sign-off. Package root: `com.morningblueprint`.

```
morning-blueprint/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties
├── gradle/
│   ├── libs.versions.toml                       # version catalog (§3)
│   └── wrapper/gradle-wrapper.properties
├── .editorconfig
├── config/
│   ├── detekt/detekt.yml
│   └── lint/lint.xml
├── .github/
│   └── workflows/
│       ├── pr.yml                               # CI stages 1–5 (§24.2)
│       ├── nightly-benchmarks.yml               # stage 6
│       └── weekly-security.yml                  # stage 7
├── docs/
│   ├── adr/                                     # ADR-001…012 as adr-NNN-title.md
│   ├── play/declarations.md                     # exact-alarm / FSI / FGS declarations
│   └── qa/a11y.md                               # TalkBack test charter
│
├── build-logic/                                 # convention plugins (§4)
│   ├── settings.gradle.kts
│   └── convention/
│       ├── build.gradle.kts
│       └── src/main/kotlin/
│           ├── AndroidApplicationConventionPlugin.kt
│           ├── AndroidLibraryConventionPlugin.kt      # mb.android.library
│           ├── AndroidFeatureConventionPlugin.kt      # mb.android.feature
│           ├── AndroidComposeConventionPlugin.kt      # mb.android.compose
│           ├── JvmLibraryConventionPlugin.kt          # mb.jvm.library
│           ├── HiltConventionPlugin.kt                # mb.hilt
│           └── ModuleGraphGuardPlugin.kt              # dependency-rule check (§4)
│
├── app/
│   ├── build.gradle.kts
│   ├── proguard-rules.pro
│   └── src/
│       ├── main/
│       │   ├── AndroidManifest.xml              # manifest-guard target (§21)
│       │   ├── kotlin/com/morningblueprint/app/
│       │   │   ├── MbApplication.kt             # Hilt app, startup orchestration (§7.3)
│       │   │   ├── MainActivity.kt              # single activity, edge-to-edge
│       │   │   ├── navigation/
│       │   │   │   ├── MbNavHost.kt             # assembles feature graphs (§15)
│       │   │   │   └── MbBottomBarVisibility.kt
│       │   │   ├── di/
│       │   │   │   ├── AppModule.kt             # Clock, MbDispatchers, AppScope
│       │   │   │   └── SnackbarModule.kt
│       │   │   └── startup/
│       │   │       ├── AppInitializer.kt        # seed reconcile, alarm sync, timer recovery
│       │   │       └── ThemeSnapshot.kt         # pre-setContent DataStore snapshot (§15)
│       │   └── res/
│       │       ├── values/{strings.xml,themes.xml}
│       │       ├── drawable/ic_launcher_foreground.xml
│       │       ├── mipmap-anydpi-v26/ic_launcher.xml
│       │       ├── raw/{mb_alarm.ogg,mb_chime.ogg}
│       │       └── xml/{data_extraction_rules.xml,backup_rules.xml,locales_config.xml}
│       ├── debug/kotlin/com/morningblueprint/app/gallery/
│       │   └── ComponentGalleryScreen.kt        # M0 parity contract (§14)
│       └── androidTest/kotlin/com/morningblueprint/app/
│           ├── journeys/                        # 6 critical journeys (§23.3)
│           │   ├── OnboardingJourneyTest.kt
│           │   ├── AlarmToggleJourneyTest.kt
│           │   ├── SessionLifecycleJourneyTest.kt
│           │   ├── JournalCrudJourneyTest.kt
│           │   ├── ReadoutJourneyTest.kt
│           │   └── BackupRestoreJourneyTest.kt
│           └── DirectBootSmokeTest.kt
│
├── core/
│   ├── designsystem/
│   │   ├── build.gradle.kts
│   │   └── src/main/kotlin/com/morningblueprint/core/designsystem/
│   │       ├── theme/
│   │       │   ├── MbTheme.kt                   # dark/light/auto + LocalMbColors (§14)
│   │       │   ├── MbTokens.kt                  # Appendix C, 1:1 with prototype CSS vars
│   │       │   ├── MbColors.kt                  # extended palette CompositionLocal
│   │       │   ├── MbType.kt                    # Cormorant Garamond / Outfit scales
│   │       │   ├── MbShapes.kt
│   │       │   └── MbMotion.kt                  # LocalMotion, reduced-motion gate
│   │       ├── component/
│   │       │   ├── MbCard.kt
│   │       │   ├── MbChip.kt
│   │       │   ├── MbProgressRing.kt            # Canvas arc + glow
│   │       │   ├── MbToggle.kt                  # 48dp target (A11Y-04)
│   │       │   ├── MbPrimaryButton.kt           # gold→violet gradient
│   │       │   ├── MbOutlineButton.kt
│   │       │   ├── MbSecondaryButton.kt
│   │       │   ├── MbTabRow.kt
│   │       │   ├── MbTopBar.kt
│   │       │   ├── MbBottomBar.kt
│   │       │   ├── MbStatusToast.kt             # snackbar with prototype pill styling
│   │       │   ├── MbSectionLabel.kt
│   │       │   ├── MbHeatmap.kt                 # single-Canvas grid (§20)
│   │       │   ├── MbSessionTicks.kt
│   │       │   ├── MbEmptyState.kt
│   │       │   └── PressScale.kt                # .965 press modifier
│   │       └── icon/MbIcons.kt                  # vector set mirroring prototype ICONS
│   │
│   ├── ui/
│   │   ├── build.gradle.kts
│   │   └── src/main/kotlin/com/morningblueprint/core/ui/
│   │       ├── nav/Routes.kt                    # @Serializable routes (§15)
│   │       ├── snackbar/SnackbarController.kt
│   │       ├── permission/
│   │       │   ├── PermissionsCoordinator.kt    # §17
│   │       │   ├── PermissionState.kt
│   │       │   └── OemBatteryGuidance.kt        # per-OEM copy table
│   │       ├── lifecycle/LifecycleEffects.kt
│   │       ├── format/RelativeDateFormatter.kt  # "Today"/"Yesterday" render-time (ADR-07)
│   │       └── preview/MbPreviews.kt            # @PreviewLightDark + fontScale 2.0
│   │
│   ├── domain/                                  # PURE JVM — no android.* (§6)
│   │   ├── build.gradle.kts
│   │   └── src/
│   │       ├── main/kotlin/com/morningblueprint/core/domain/
│   │       │   ├── model/
│   │       │   │   ├── Session.kt               # + SessionId value class, Phase enum
│   │       │   │   ├── SessionCompletion.kt     # + Outcome enum
│   │       │   │   ├── DayProgress.kt
│   │       │   │   ├── StreakState.kt
│   │       │   │   ├── Declaration.kt           # + DeclarationCategory
│   │       │   │   ├── Scripture.kt             # + Translation enum
│   │       │   │   ├── JournalEntry.kt
│   │       │   │   ├── BigThree.kt              # + TaskSlot, TaskCategory
│   │       │   │   ├── UserPrefs.kt             # + ThemeMode, VibrationPattern
│   │       │   │   ├── TimerState.kt
│   │       │   │   └── AlarmConfig.kt
│   │       │   ├── repository/                  # interfaces only (§6.2)
│   │       │   │   ├── SessionRepository.kt
│   │       │   │   ├── CompletionRepository.kt
│   │       │   │   ├── JournalRepository.kt
│   │       │   │   ├── DeclarationRepository.kt
│   │       │   │   ├── ScriptureRepository.kt
│   │       │   │   ├── PlannerRepository.kt
│   │       │   │   ├── AlarmConfigRepository.kt
│   │       │   │   ├── PrefsRepository.kt
│   │       │   │   ├── BackupRepository.kt
│   │       │   │   └── TimerStateRepository.kt
│   │       │   ├── platform/                    # platform seams (§6.2)
│   │       │   │   ├── AlarmScheduler.kt
│   │       │   │   ├── TimerEngine.kt
│   │       │   │   ├── Speech.kt
│   │       │   │   ├── HapticsController.kt
│   │       │   │   └── Clock.kt
│   │       │   ├── calculator/
│   │       │   │   ├── StreakCalculator.kt
│   │       │   │   ├── DayKeyResolver.kt
│   │       │   │   ├── NextAlarmTimeCalculator.kt
│   │       │   │   ├── ReadoutPlaylistResolver.kt
│   │       │   │   ├── DailyVerseSelector.kt
│   │       │   │   ├── HeatmapBucketer.kt
│   │       │   │   └── PhaseRateCalculator.kt
│   │       │   └── usecase/
│   │       │       ├── CompleteSessionUseCase.kt
│   │       │       ├── StartSessionUseCase.kt   # single-timer invariant I1
│   │       │       ├── SkipSessionUseCase.kt
│   │       │       ├── ToggleAlarmUseCase.kt
│   │       │       ├── SaveJournalEntryUseCase.kt
│   │       │       ├── DeleteJournalEntryUseCase.kt
│   │       │       ├── CommitBigThreeUseCase.kt
│   │       │       ├── RolloverUseCase.kt
│   │       │       ├── ExportBackupUseCase.kt
│   │       │       ├── RestoreBackupUseCase.kt
│   │       │       ├── ExportJournalUseCase.kt
│   │       │       └── result/UseCaseResults.kt # sealed results (§19)
│   │       └── test/kotlin/com/morningblueprint/core/domain/
│   │           ├── calculator/                  # §23.2 suites
│   │           │   ├── StreakCalculatorTest.kt
│   │           │   ├── NextAlarmTimeCalculatorTest.kt
│   │           │   ├── DailyVerseSelectorTest.kt
│   │           │   ├── ReadoutPlaylistResolverTest.kt
│   │           │   └── HeatmapBucketerTest.kt
│   │           └── usecase/
│   │               ├── RolloverUseCaseTest.kt
│   │               ├── StartSessionUseCaseTest.kt
│   │               └── CompleteSessionUseCaseTest.kt
│   │
│   ├── data/
│   │   ├── build.gradle.kts
│   │   ├── schemas/                             # exported Room schemas (§7.1)
│   │   └── src/
│   │       ├── main/
│   │       │   ├── kotlin/com/morningblueprint/core/data/
│   │       │   │   ├── db/
│   │       │   │   │   ├── MbDatabase.kt
│   │       │   │   │   ├── MbTypeConverters.kt
│   │       │   │   │   ├── entity/
│   │       │   │   │   │   ├── SessionEntity.kt
│   │       │   │   │   │   ├── AlarmConfigEntity.kt
│   │       │   │   │   │   ├── SessionCompletionEntity.kt
│   │       │   │   │   │   ├── DailySummaryEntity.kt
│   │       │   │   │   │   ├── JournalEntryEntity.kt
│   │       │   │   │   │   ├── DeclarationEntity.kt
│   │       │   │   │   │   ├── ScriptureEntity.kt
│   │       │   │   │   │   ├── BookmarkEntity.kt
│   │       │   │   │   │   ├── TaskEntity.kt
│   │       │   │   │   │   └── TimerStateEntity.kt
│   │       │   │   │   └── dao/
│   │       │   │   │       ├── SessionDao.kt
│   │       │   │   │       ├── AlarmConfigDao.kt
│   │       │   │   │       ├── CompletionDao.kt
│   │       │   │   │       ├── DailySummaryDao.kt
│   │       │   │   │       ├── JournalDao.kt
│   │       │   │   │       ├── DeclarationDao.kt
│   │       │   │   │       ├── ScriptureDao.kt
│   │       │   │   │       ├── BookmarkDao.kt
│   │       │   │   │       ├── TaskDao.kt
│   │       │   │   │       └── TimerStateDao.kt
│   │       │   │   ├── prefs/
│   │       │   │   │   ├── MbDataStore.kt
│   │       │   │   │   └── PrefsRepositoryImpl.kt
│   │       │   │   ├── repository/              # domain impls (§7.4)
│   │       │   │   │   ├── SessionRepositoryImpl.kt
│   │       │   │   │   ├── CompletionRepositoryImpl.kt
│   │       │   │   │   ├── JournalRepositoryImpl.kt
│   │       │   │   │   ├── DeclarationRepositoryImpl.kt
│   │       │   │   │   ├── ScriptureRepositoryImpl.kt
│   │       │   │   │   ├── PlannerRepositoryImpl.kt
│   │       │   │   │   ├── AlarmConfigRepositoryImpl.kt
│   │       │   │   │   └── TimerStateRepositoryImpl.kt
│   │       │   │   ├── seed/
│   │       │   │   │   ├── SeedReconciler.kt    # ADR-06
│   │       │   │   │   ├── SeedParser.kt
│   │       │   │   │   └── SeedModels.kt
│   │       │   │   ├── backup/
│   │       │   │   │   ├── BackupRepositoryImpl.kt
│   │       │   │   │   ├── BackupCodec.kt       # v1/v2 sniff + decode (§12.1)
│   │       │   │   │   ├── BackupSanitizer.kt   # hostile-input pipeline (§12.3)
│   │       │   │   │   ├── V1BackupDecoder.kt   # prototype import mapping
│   │       │   │   │   ├── V2BackupSchema.kt
│   │       │   │   │   └── SafetyBackupStore.kt # rotating pre-restore backups
│   │       │   │   ├── export/
│   │       │   │   │   ├── JournalPdfExporter.kt   # PdfDocument, no WebView (SP-06)
│   │       │   │   │   ├── JournalMarkdownExporter.kt
│   │       │   │   │   └── FilenameSanitizer.kt
│   │       │   │   ├── work/
│   │       │   │   │   ├── MidnightRolloverWorker.kt
│   │       │   │   │   ├── DailySummaryWorker.kt
│   │       │   │   │   └── BackupReminderWorker.kt
│   │       │   │   └── di/DataModule.kt         # binds repos, provides DB/DataStore
│   │       │   └── assets/seed/
│   │       │       ├── sessions.json
│   │       │       ├── declarations.json
│   │       │       ├── scriptures.json          # ≥90 verses × bundled translations
│   │       │       └── prompts.json
│   │       └── test/kotlin/com/morningblueprint/core/data/
│   │           ├── db/{MigrationTest.kt,CompletionDaoTest.kt,JournalDaoTest.kt}
│   │           ├── backup/
│   │           │   ├── BackupSanitizerTest.kt   # fuzz corpus
│   │           │   ├── BackupRoundTripTest.kt   # golden-file identity
│   │           │   └── fixtures/prototype-v1-export.json
│   │           └── seed/SeedReconcilerTest.kt
│   │
│   ├── alarm/
│   │   ├── build.gradle.kts
│   │   └── src/
│   │       ├── main/
│   │       │   ├── AndroidManifest.xml          # receivers, AlarmActivity, services
│   │       │   └── kotlin/com/morningblueprint/core/alarm/
│   │       │       ├── scheduler/
│   │       │       │   ├── AlarmSchedulerImpl.kt      # setAlarmClock (ADR-02)
│   │       │       │   ├── AlarmRescheduler.kt        # syncAll(), 6 triggers (§8.4)
│   │       │       │   └── AlarmPendingIntents.kt     # PI factory, requestCode=sessionId
│   │       │       ├── receiver/
│   │       │       │   ├── AlarmReceiver.kt           # fire path (§8.3)
│   │       │       │   ├── BootReceiver.kt            # directBootAware
│   │       │       │   ├── TimeChangeReceiver.kt
│   │       │       │   ├── PackageReplacedReceiver.kt
│   │       │       │   └── ExactAlarmPermissionReceiver.kt
│   │       │       ├── ring/
│   │       │       │   ├── AlarmRingerService.kt      # FGS, sound+vibration owner
│   │       │       │   ├── AlarmRinger.kt             # MediaPlayer USAGE_ALARM, ramp
│   │       │       │   ├── SnoozePolicy.kt            # 9min ×3, discipline gate
│   │       │       │   └── MissedAlarmHandler.kt
│   │       │       ├── ui/
│   │       │       │   ├── AlarmActivity.kt           # showWhenLocked (ADR-01)
│   │       │       │   ├── AlarmRingScreen.kt
│   │       │       │   ├── AlarmRingViewModel.kt
│   │       │       │   └── HoldToDismiss.kt           # 2s hold + a11y action (A11Y-06)
│   │       │       ├── timer/
│   │       │       │   ├── TimerService.kt            # FGS specialUse (ADR-04)
│   │       │       │   ├── TimerEngineImpl.kt         # state machine (§9.1)
│   │       │       │   ├── TimerRecovery.kt           # death/reboot reconstruction
│   │       │       │   └── TimerNotification.kt
│   │       │       ├── directboot/DeviceProtectedAlarmMirror.kt  # §8.6
│   │       │       ├── notification/MbNotificationChannels.kt    # §16
│   │       │       ├── haptics/HapticsControllerImpl.kt
│   │       │       ├── speech/AndroidSpeech.kt        # TTS impl (§11.3)
│   │       │       ├── diag/
│   │       │       │   ├── Breadcrumbs.kt             # ring buffer (§25)
│   │       │       │   └── AlarmHealthCheck.kt
│   │       │       └── di/AlarmModule.kt
│   │       └── test/kotlin/com/morningblueprint/core/alarm/
│   │           ├── AlarmReconciliationTest.kt   # ShadowAlarmManager
│   │           ├── TimerRecoveryTest.kt
│   │           └── SnoozePolicyTest.kt
│   │
│   └── testing/
│       ├── build.gradle.kts
│       └── src/main/kotlin/com/morningblueprint/core/testing/
│           ├── FixedClock.kt
│           ├── MainDispatcherRule.kt
│           ├── fake/
│           │   ├── FakeCompletionRepository.kt
│           │   ├── FakeJournalRepository.kt
│           │   ├── FakeDeclarationRepository.kt
│           │   ├── FakePrefsRepository.kt
│           │   ├── FakeSpeech.kt
│           │   └── RecordingAlarmScheduler.kt
│           └── fixture/{SeedFixtures.kt,SyntheticJournal.kt}
│
├── feature/                                     # every module: ui/ + vm/ pattern (§13.1)
│   ├── onboarding/src/main/kotlin/com/morningblueprint/feature/onboarding/
│   │   ├── OnboardingRoute.kt
│   │   ├── OnboardingScreen.kt                  # 3 slides, permission slide
│   │   ├── OnboardingViewModel.kt
│   │   ├── OnboardingUiState.kt
│   │   └── SplashConfig.kt
│   ├── home/src/main/kotlin/com/morningblueprint/feature/home/
│   │   ├── HomeRoute.kt / HomeScreen.kt / HomeViewModel.kt / HomeUiState.kt
│   │   └── component/{StreakBadge.kt,TodayProgressCard.kt,PhaseCard.kt,
│   │                  VerseTeaserCard.kt,QuickAccessGrid.kt}
│   ├── sessions/src/main/kotlin/com/morningblueprint/feature/sessions/
│   │   ├── SessionsRoute.kt / SessionsScreen.kt / SessionsViewModel.kt / SessionsUiState.kt
│   │   └── component/{PhaseHeader.kt,SessionCard.kt}
│   ├── timer/src/main/kotlin/com/morningblueprint/feature/timer/
│   │   ├── ActiveSessionRoute.kt / ActiveSessionScreen.kt
│   │   ├── ActiveSessionViewModel.kt / ActiveSessionUiState.kt
│   │   └── component/{TimerReadout.kt,TimerRing.kt,SessionPromptCard.kt}
│   ├── scripture/src/main/kotlin/com/morningblueprint/feature/scripture/
│   │   ├── ScriptureRoute.kt / ScriptureScreen.kt
│   │   ├── ScriptureViewModel.kt / ScriptureUiState.kt
│   │   └── component/{VerseFeatureCard.kt,MeditationPromptList.kt,TranslationBadges.kt}
│   ├── declarations/src/main/kotlin/com/morningblueprint/feature/declarations/
│   │   ├── library/{DeclarationsRoute.kt,DeclarationsScreen.kt,
│   │   │            DeclarationsViewModel.kt,DeclarationsUiState.kt}
│   │   └── readout/{ReadoutRoute.kt,ReadoutScreen.kt,ReadoutViewModel.kt,
│   │                ReadoutUiState.kt,SpeakingBars.kt}
│   ├── journal/src/main/kotlin/com/morningblueprint/feature/journal/
│   │   ├── list/{JournalRoute.kt,JournalScreen.kt,JournalViewModel.kt,JournalUiState.kt}
│   │   └── editor/{JournalEditorRoute.kt,JournalEditorScreen.kt,
│   │               JournalEditorViewModel.kt,JournalEditorUiState.kt,
│   │               SessionPickerMenu.kt,DraftStore.kt}
│   ├── planner/src/main/kotlin/com/morningblueprint/feature/planner/
│   │   ├── PlannerRoute.kt / PlannerScreen.kt / PlannerViewModel.kt / PlannerUiState.kt
│   │   └── component/{TaskSlotCard.kt,CategoryRow.kt}
│   ├── analytics/src/main/kotlin/com/morningblueprint/feature/analytics/
│   │   ├── AnalyticsRoute.kt / AnalyticsScreen.kt
│   │   ├── AnalyticsViewModel.kt / AnalyticsUiState.kt
│   │   └── component/{StreakHeroCard.kt,StatGrid.kt,PhaseRateBars.kt,WeeklySummaryCard.kt}
│   └── settings/src/main/kotlin/com/morningblueprint/feature/settings/
│       ├── SettingsRoute.kt / SettingsScreen.kt / SettingsViewModel.kt / SettingsUiState.kt
│       ├── alarms/{AlarmsRoute.kt,AlarmsScreen.kt,AlarmsViewModel.kt,AlarmsUiState.kt}
│       ├── data/{BackupRestoreSheet.kt,ExportSheet.kt}
│       └── diag/AlarmHealthCheckScreen.kt       # hidden, version-tap ×5 (§25)
│
└── baselineprofile/
    ├── build.gradle.kts
    └── src/main/kotlin/com/morningblueprint/baselineprofile/
        ├── BaselineProfileGenerator.kt
        ├── StartupBenchmark.kt
        └── JournalScrollBenchmark.kt
```

Each `:feature:*` module also carries `src/test/kotlin/.../XxxViewModelTest.kt` (Turbine) and screenshot tests under `src/test/kotlin/.../XxxScreenshotTest.kt` (Roborazzi) — omitted above for brevity but required by the Definition of Done (§26).

---

## 29. Phased Execution Plan (First → Last)

Granular build order within the PRD's M0–M4 envelope. Phases are strictly ordered by dependency; within a phase, workstreams marked ∥ run in parallel across the two engineers (E1, E2). Every phase has a hard **exit gate** — do not start the next phase's dependent work until the gate passes.

```
P0 → P1 ─┬→ P2 ─┬→ P4 (alarms) ──┬→ P5 (timer) → P6 (tracking) ─┬→ P9 → P10 → P11 → P12 → P13
         │      └→ P3 (shell)  ──┘                              │
         └────────────────────────→ P7 (content) → P8 (journal) ┘
Critical path: P0→P1→P2→P4→P5→P6→P10→P11→P12   (alarm/timer chain — never starve it)
```

### Phase 0 — Project Bootstrap (wk 1, both engineers) `[M0]`
**Build:** repo layout per §28; `build-logic` convention plugins incl. `ModuleGraphGuardPlugin`; version catalog; empty modules compiling; CI pipeline stages 1–5 live (`pr.yml`) including `manifest-guard`; detekt/ktlint/lint configs; PR template; ADR-001…012 committed to `docs/adr/`.
**Exit gate:** a PR touching any module builds, lints, and runs (empty) tests in CI; a deliberately added `INTERNET` permission fails CI.

### Phase 1 — Design System & Parity Contract (wk 1–3, E2 leads) `[M0]`
**Build:** `:core:designsystem` complete — `MbTokens.kt` (Appendix C), `MbTheme`, typography with bundled fonts, all components listed in §28, `PressScale`, reduced-motion gate; debug `ComponentGalleryScreen` rendering every component beside prototype screenshots; Roborazzi baselines (light/dark/2.0 font).
**Exit gate:** design/PM sign-off on the gallery = the visual parity contract (PRD R8). *This gate freezes tokens; later visual disputes reference the gallery, not the prototype.*

### Phase 2 — Data Foundation (wk 2–3, E1 leads, ∥ with P1) `[M0]`
**Build:** `:core:domain` models/interfaces/calculators (with full unit suites — the calculators are pure and testable now); `:core:data` Room schema v1 + DAOs + converters, DataStore prefs, seed JSON (prototype content) + `SeedReconciler`, repository impls; `:core:testing` fakes and fixtures.
**Exit gate:** all §23.2 domain suites green; DAO tests green; seed loads idempotently (run ×3 = same rows); schema exported and committed.

### Phase 3 — App Shell, Navigation & Onboarding (wk 3–4, E2) `[M0]`
**Build:** `MainActivity` + `MbNavHost` with all routes stubbed, bottom bar with per-tab back stacks, deep-link declarations, splash + `ThemeSnapshot`, theming end-to-end (dark/light/auto switch live in Settings skeleton), onboarding 3 slides + `PermissionsCoordinator` (notifications, exact-alarm state surfacing).
**Exit gate:** journey test #1 (onboarding→home) green; predictive back verified; theme switch instant; nav state survives process death (don't defer this — it shapes ViewModel design).

### Phase 4 — Alarm & Wake Subsystem (wk 4–6, E1 — critical path, starts the moment P2 gates) `[M1]`
**Build order within phase:** (1) `AlarmSchedulerImpl` + PI factory + `NextAlarmTimeCalculator` wiring → (2) `AlarmReceiver` fire path (reschedule-first) + `AlarmRingerService`/`AlarmRinger` → (3) `AlarmActivity` + ring screen + `SnoozePolicy` + `HoldToDismiss` (discipline) → (4) `BootReceiver`/`TimeChangeReceiver`/`PackageReplacedReceiver` + `AlarmRescheduler.syncAll()` → (5) direct-boot mirror → (6) `MissedAlarmHandler`; Alarms setup screen (`:feature:settings/alarms`) wired to `ToggleAlarmUseCase`.
∥ E2 meanwhile: Home + Sessions screens against fake/live repos (completed-state rendering, phase tabs, CTA logic).
**Exit gate:** journey test #2 green; `AlarmReconciliationTest` green; **overnight physical-device test fires on Pixel + Samsung + Xiaomi** (Appendix D charter round 1); reboot-with-pending-alarm fires; stale-fire rejected.

### Phase 5 — Session Timer (wk 6–7, E1) `[M1]`
**Build:** `TimerService`/`TimerEngineImpl` state machine, Room `timer_state` mirroring, end-of-session exact-alarm backstop, `TimerRecovery`, `TimerNotification`; `:feature:timer` ActiveSession screen (ring, readout isolation, controls, keep-screen-on); single-timer invariant surfaced in UI.
**Exit gate:** `TimerRecoveryTest` green (kill mid-run, reboot, finished-while-dead); journey test #3 green; recomposition budget met (§20 table); ADR-04 Play declaration drafted — **submit an internal-track build now to smoke-test FGS review early.**

### Phase 6 — Tracking, Rollover & Live Dashboards (wk 7, both) `[M1]`
**Build:** `CompleteSessionUseCase`/`SkipSessionUseCase` writing completions + summaries transactionally; `RolloverUseCase` + `MidnightRolloverWorker` + foreground check + `DayChanged` flow; Home/Sessions fully data-driven (delete every remaining hardcoded value); Big Three planner screen + daily slot creation.
**Exit gate:** M1 milestone review — complete a full simulated day (time-travel via `FixedClock` build flag): alarms→sessions→completions→rollover→next day clean; `RolloverUseCaseTest` idempotency green.

### Phase 7 — Content: Scripture, Declarations, TTS (wk 8–9, E2; ∥ E1 starts Phase 10 backup codec) `[M2]`
**Build:** Scripture screen (rotation via `DailyVerseSelector`, translation switcher over bundled translations only, bookmarks + list, prompt pools); Declarations library (active toggles, category tabs) + Readout (playlist-resolved-once, index/transport, `AndroidSpeech` with focus handling, speaking-bars, unavailable-TTS fallback); seed expansion to ≥ 90 verses lands here (content task — licensing answer from PRD Q1 is a **hard input to this phase; escalate in wk 6 if unresolved**).
**Exit gate:** journey test #5 green; verse deterministic across process restarts; TTS verified on a device with no network and on one with the engine's language pack missing.

### Phase 8 — Journal & Editor (wk 9–10, E2) `[M2]`
**Build:** journal list (filters, relative dates render-time), editor (session picker, empty-save rejection, 20k cap, draft persistence via `DraftStore` + `SavedStateHandle`), delete + undo snackbar, in-session journal entry (timer intact on return).
**Exit gate:** journey test #4 green; draft survives process death; M2 review passes all P0 ACs for E5/E6.

### Phase 9 — Analytics (wk 11, E2) `[M3]`
**Build:** SQL aggregates (streak window, totals, phase rates, heatmap, weekly summary) + `:feature:analytics` screen + Home streak badge unification; empty states for day-1 users.
**Exit gate:** streak values on Home and Analytics provably identical (single use-case source); synthetic 400-day dataset renders < 1 frame budget; zero invented numbers anywhere (grep-level audit of hardcoded literals).

### Phase 10 — Backup, Restore & Export (wk 10–12, E1) `[M3]`
**Build:** `BackupCodec` v2 + `V1BackupDecoder` (with the committed prototype export fixture), `BackupSanitizer` + fuzz corpus, SAF flows, `SafetyBackupStore`, transactional apply + recovery flag, post-restore hooks (seed reconcile, summary rebuild, `syncAll`, streak recompute); `JournalPdfExporter` + `JournalMarkdownExporter`; Auto Backup rules verified device-to-device; backup reminder worker.
**Exit gate:** journey test #6 green; golden-file round-trip identity; restore of a real prototype-exported file produces correct entries; malformed-corpus suite 100 % rejected with zero partial writes.

### Phase 11 — Hardening & NFR Sweep (wk 13–14, both) `[M4]`
**Build/verify:** Baseline Profiles + Macrobenchmark budgets enforced in nightly CI; APK-size gate; battery overnight matrix; full a11y audit (TalkBack charter, contrast test, 200 % font screenshots) and fixes; StrictMode clean; migration test 1→1 trivially green but harness proven; Appendix D manual charter executed on all matrix devices; breadcrumbs + Alarm Health Check screen finished; Play listing, data-safety form, declarations submitted.
**Exit gate:** every NFR-01…12 measured with evidence attached to the milestone review; zero P0/P1 bugs open; release checklist signed.

### Phase 12 — Beta → GA (wk 14–15+) `[M4→GA]`
**Do:** closed beta (≥ 20 users, PRD M4) with a 2-week soak focused on alarm reliability reports; triage weekly; staged rollout 10 → 25 → 50 → 100 % with §24.3 halt criteria; monitor Play vitals daily during rollout.
**Exit gate (project "last"):** 100 % rollout stable ≥ 7 days at PG-5 thresholds → tag `v1.0.0`, open v1.1 planning.

### Phase 13 — V1.1 (post-GA, +6 wk)
Order: custom schedule (`E2-S5`, touches alarm math — do first while context is warm) → phase-transition alerts → voice dictation (`RECORD_AUDIO` flow) → custom declarations CRUD → journal tags + FTS search → Glance widget → biometric app lock/`FLAG_SECURE`. Each item enters through the same gates: ADR if it touches §5/8/9/12, tests per §23, gallery update if visual.

**Standing rules across all phases:** the alarm chain (P4–P6) is never blocked by polish work; any phase slipping > 3 days triggers scope review against its milestone; every exit gate produces a short written record in `docs/adr/` or the milestone notes — gates are evidence, not ceremonies.

---

## 30. Appendix A — Full Room Schema (DDL-level)

```sql
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY NOT NULL,              -- 1..8, seeded
  seedKey TEXT NOT NULL UNIQUE,
  phase INTEGER NOT NULL,                       -- 1..3
  title TEXT NOT NULL, emoji TEXT NOT NULL,
  defaultStartMin INTEGER NOT NULL,             -- minutes from midnight (180 = 3:00)
  durationMin INTEGER NOT NULL,
  description TEXT NOT NULL, prompt TEXT NOT NULL,
  sortOrder INTEGER NOT NULL
);

CREATE TABLE alarm_configs (
  sessionId INTEGER PRIMARY KEY NOT NULL REFERENCES sessions(id),
  enabled INTEGER NOT NULL DEFAULT 0,
  startMinOverride INTEGER                      -- null = defaultStart + global shift
);

CREATE TABLE session_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                           -- ISO yyyy-MM-dd (product day)
  sessionId INTEGER NOT NULL REFERENCES sessions(id),
  outcome TEXT NOT NULL,                        -- COMPLETED | SKIPPED
  completedAt TEXT NOT NULL,                    -- ISO instant UTC
  elapsedSec INTEGER NOT NULL,
  UNIQUE(date, sessionId)
);
CREATE INDEX idx_completions_date ON session_completions(date);

CREATE TABLE daily_summaries (
  date TEXT PRIMARY KEY NOT NULL,
  sessionsCompleted INTEGER NOT NULL,
  minutes INTEGER NOT NULL,
  counted INTEGER NOT NULL                      -- streak-counted day
);

CREATE TABLE journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sessionId INTEGER NOT NULL REFERENCES sessions(id),
  body TEXT NOT NULL,                           -- ≤ 20_000 chars (app-enforced)
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_journal_created ON journal_entries(createdAt DESC);
-- P1: CREATE VIRTUAL TABLE journal_fts USING fts5(body, content=journal_entries…)

CREATE TABLE declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seedKey TEXT UNIQUE,                          -- null for custom
  category TEXT NOT NULL,
  text TEXT NOT NULL, reference TEXT,
  isCustom INTEGER NOT NULL DEFAULT 0,
  isActive INTEGER NOT NULL DEFAULT 0,
  sortOrder INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE scriptures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seedKey TEXT NOT NULL, reference TEXT NOT NULL,
  translation TEXT NOT NULL, text TEXT NOT NULL, themeTag TEXT,
  promptSetKey TEXT,
  UNIQUE(seedKey, translation)
);

CREATE TABLE bookmarks (
  scriptureSeedKey TEXT PRIMARY KEY NOT NULL,   -- translation-independent
  createdAt TEXT NOT NULL
);

CREATE TABLE tasks (
  date TEXT NOT NULL, slot INTEGER NOT NULL,    -- 1..3
  text TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT 'Purpose',
  done INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(date, slot)
);

CREATE TABLE timer_state (                      -- singleton (id = 1)
  id INTEGER PRIMARY KEY CHECK (id = 1),
  sessionId INTEGER, status TEXT NOT NULL,      -- IDLE/RUNNING/PAUSED/FINISHED
  endsAtWallClock TEXT, endsAtElapsedRealtime INTEGER,
  pausedRemainingSec INTEGER, updatedAt TEXT NOT NULL
);
```

## 31. Appendix B — Backup JSON Schemas (v1/v2)

**v1 (prototype, import-only):**
```json
{ "version": 1, "exportedAt": "ISO",
  "data": { "alarms": {"1": true}, "translation": "NIV",
            "bookmarked": [1], "journal": [{"id":1,"session":"Sacred Silence",
            "phase":1,"date":"Today","preview":"…"}],
            "activeDeclarations": [1,2], "tasks": [{"text":"…","cat":"Work","done":false}],
            "prefs": {"theme":"dark","translation":"NIV","vibration":true,
                      "phaseAlerts":true,"discipline":false} } }
```

**v2 (export + import):**
```json
{ "version": 2, "exportedAt": "ISO", "appVersion": "1.0.0",
  "data": {
    "alarmConfigs":   [{"sessionId":1,"enabled":true,"startMinOverride":null}],
    "completions":    [{"date":"2026-07-16","sessionId":2,"outcome":"COMPLETED",
                        "completedAt":"ISO","elapsedSec":1800}],
    "journal":        [{"id":1,"sessionId":3,"body":"…","createdAt":"ISO",
                        "updatedAt":"ISO","starred":false}],
    "declarations":   [{"seedKey":"finances","isActive":true},
                       {"custom":true,"category":"Custom","text":"…","isActive":true}],
    "bookmarks":      ["jer-29-11"],
    "tasks":          [{"date":"2026-07-16","slot":1,"text":"…","category":"Work","done":true}],
    "prefs":          {"theme":"dark","translation":"KJV","vibration":"CALM",
                       "phaseAlerts":true,"disciplineMode":false,
                       "displayName":null,"scheduleShiftMin":0}
  } }
```
Decoder rules: `ignoreUnknownKeys`, missing arrays = empty, caps per Section 12.3.

## 32. Appendix C — Design Tokens

Dark (light per prototype `:root[data-theme=light]`):

| Token | Value | Token | Value |
|---|---|---|---|
| bg | `#07070F` | gold | `#C9A44A` |
| page | `#020209` | goldLight | `#E5C870` |
| surface | `#0C0C1C` | violet | `#7C5DBE` |
| card | `#101028` | violetLight | `#A07EE0` |
| cardHi | `#14143A` | blue (phase 1) | `#4B90D6` |
| border | `#1A1A32` | green | `#52BE7C` |
| borderHi | `#28284E` | red | `#E25560` |
| txt | `#EDE7DC` | txt2 | `#8A879E` |
| txt3 (decorative only) | `#4C4A66` | | |

Dim/border variants = base color at 11 % / 22 % alpha (matches prototype `*-d` / `*-b`). Shapes: card 18 dp, button 16 dp, hero 22–24 dp, chip pill. Motion: fadeIn 380 ms, slideUp 400 ms, scaleIn spring (overshoot 1.56 cubic-bezier equiv.), press scale 0.965. Type scale: displaySerif 34/600, timerSerif 54/400, statSerif 32–48/600, title 18/700, body 15/400, caption 11–12, overline 11/700 +10 % tracking uppercase.

## 33. Appendix D — Test Device & OEM Matrix

| Device class | API | Purpose |
|---|---|---|
| Pixel (reference) | 36 | primary dev target, benchmarks |
| Pixel or emulator | 26 | minSdk floor (pre-channel, pre-FSI-permission behaviors) |
| Samsung Galaxy mid-range (One UI) | 34/35 | doze/battery ("adaptive battery"), FSI behavior |
| Xiaomi/Redmi (HyperOS/MIUI) | 34+ | aggressive app-kill: alarm reliability worst case |
| OnePlus/Oppo (ColorOS) | 34+ | battery optimization variant |
| Emulator foldable + tablet profile | 36 | NFR-06 no-crash/sane-layout check |

Per-release manual charter: overnight alarm test (device idle ≥ 6 h, Doze confirmed via `dumpsys deviceidle`), reboot-with-pending-alarm, direct-boot fire, timezone flight simulation, 200 % font + TalkBack sweep on the 6 critical journeys.

---

*End of document. Change control: material changes to Sections 5, 8, 9, or 12 require an ADR and reviewer sign-off from the tech lead; token/table appendices track the prototype and PRD as their sources of truth.*
