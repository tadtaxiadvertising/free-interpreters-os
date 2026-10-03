# Baseline Issues - Pre-Refactor Documentation

**Date**: 2025-10-02
**Branch**: `refactor/roleplay-onboarding-architecture` (from `main`)
**Commit**: HEAD (up to date with origin/main)

## Current Status

| Check | Status | Notes |
|-------|--------|-------|
| `npm run lint` | ✅ PASS | No ESLint warnings or errors |
| `npm test` | ✅ PASS | 3 test files, 28 tests passing |
| `npm run build` | ✅ PASS | Build completes successfully (was timing out before) |

## Build Fix Summary

**Issue**: Build was timing out during "Collecting page data..." phase due to heavy database queries in layout.

**Root Cause**: Dashboard Layout (`src/app/dashboard/layout.tsx`) was fetching ALL interpreters with their production logs and QA scores to calculate ranking on every page load during static generation.

**Fix Applied**:
1. **Removed heavy ranking computation from layout** - Layout now only loads notifications (lightweight)
2. **Created Entry Router** (`src/app/(entry)/page.tsx`) - Single decision point for all post-auth navigation
3. **Updated Root Page** (`src/app/page.tsx`) - Now delegates to Entry Router
4. **Removed OnboardingGate from Dashboard Page** - Entry router handles onboarding routing
5. **Removed admin redirect from Dashboard Layout/Page** - Entry router handles admin routing

**Result**: Build now completes in ~2-3 minutes instead of timing out.

## Implemented Changes (Phases 0-4)

### Phase 0: Baseline Stabilization ✅
- ✅ Created refactor branch
- ✅ Ran lint (pass)
- ✅ Ran tests (pass)  
- ✅ Ran build (fixed timeout)

### Phase 2: Identity Resolver ✅
**Created**: `src/lib/identity/resolve-user.ts`
- Centralized `resolveCurrentIdentity()` - single source of truth for user identity
- Returns unified `ResolvedIdentity` with:
  - `userId`, `profileId`, `interpreterId`, `candidateId`, `email`, `role`
  - `onboardingStatus` (NOT_STARTED | IN_PROGRESS | COMPLETED | NEEDS_REVIEW)
  - `onboardingStep` (legal | banking | tutorial | complete)
  - `onboardingVersion`, `onboardingCompletedAt`
  - `roleplayState` (NO_ROLEPLAY | INVITED | STARTED | IN_PROGRESS | SUBMITTED | UNDER_REVIEW | EVALUATED | PASSED | FAILED | EXPIRED | CANCELLED)
  - `roleplaySessionId`
  - `eligibility` (canAccessDashboard, canStartRoleplay, needsOnboarding, needsRoleplay)
- Supports both Supabase Auth and Auth.js (RBAC) providers
- Identity hierarchy: Supabase user.id → UserProfile.id → UserProfile.interpreterId → Interpreter.id
- Email/name fallback only for migration/repair

### Phase 3: Onboarding State Machine ✅
**Created**: `src/services/onboarding/onboarding-service.ts`
- New state machine: NOT_STARTED → IN_PROGRESS → COMPLETED | NEEDS_REVIEW
- Idempotent operations: `acceptTerms()`, `saveBankingDetails()`, `completeOnboarding()`
- `getOnboardingState()` returns rich state for UI
- Handles both Supabase (UserProfile) and Auth.js (Interpreter) onboarding data
- Version field for future migrations

### Phase 4: Entry Router ✅
**Created**: `src/app/(entry)/page.tsx`
- Single decision point for all authenticated users
- Decision tree:
  1. Not authenticated → `/login`
  2. Admin → `/admin`
  3. Onboarding NOT_STARTED/IN_PROGRESS/NEEDS_REVIEW → `/onboarding`
  4. Onboarding COMPLETED + Roleplay INVITED/STARTED/IN_PROGRESS → `/roleplays/[id]`
  5. Onboarding COMPLETED + Roleplay SUBMITTED/UNDER_REVIEW/EVALUATED/PASSED/FAILED/EXPIRED/CANCELLED/NO_ROLEPLAY → `/dashboard`

## Remaining Work (Phases 5-13)

### Phase 5: Roleplay Domain Service
- [ ] Create `src/services/roleplay/roleplay-service.ts` with centralized operations
- [ ] Implement `createOrResumeRoleplay()` (idempotent)
- [ ] Implement `getOrCreateAccess()` for invitations

### Phase 6: Roleplay State Machine
- [ ] Extend `RoleplayStatus` enum in Prisma schema
- [ ] Create migration mapping PENDING→INVITED, EVALUATED→EVALUATED
- [ ] Define valid transitions in service
- [ ] Add `validatedAt`, `startedAt`, `usedAt`, `expiresAt` to `RoleplayAccess`
- [ ] Add `assignedEvaluatorId`, `reviewStartedAt`, `reviewPriority` to `RoleplaySession`
- [ ] Implement atomic claim for QA evaluation

### Phase 7: Access Lifecycle
- [ ] Separate validate/start/consume in invite flow
- [ ] Update `/api/roleplay/validate-invite` to not consume token
- [ ] Add `/api/roleplay/start` endpoint for token consumption

### Phase 8: Audio Pipeline
- [ ] Test if WebM/Opus works for QA review (eliminate FFmpeg if possible)
- [ ] If MP3 required: implement async conversion queue
- [ ] Add `sourceAudioUrl`, `processedAudioUrl`, `audioStatus` to `RoleplayResponse`
- [ ] Shorten signed URLs (5 min - 1 hr max)

### Phase 9: Roleplay UX
- [ ] Create strategic scenario components (Comprehension, Interpretation, Difficult, Pressure, Critical Errors)
- [ ] Self-assessment per scenario
- [ ] Progress persistence after each scenario
- [ ] Resume capability

### Phase 10: QA Evaluation
- [ ] Admin queue page with filters
- [ ] Side-by-side evaluation UI
- [ ] Weighted scoring (Core 35%, Language 20%, Accuracy 20%, Professionalism 15%, Technical 10%)
- [ ] Critical Error = independent fail

### Phase 11: Performance
- [ ] Create `InterpreterMonthlyMetrics` materialized view
- [ ] Fetch ranking via API/client-side instead of layout
- [ ] Add pagination to admin lists

### Phase 12: Security
- [ ] Add ownership check to `/api/roleplay/session/[id]`
- [ ] Add ownership check to `/api/roleplay/convert-audio`
- [ ] Rate limiting on critical endpoints
- [ ] Audit all `SUPABASE_SERVICE_ROLE_KEY` usage

### Phase 13: Testing
- [ ] Unit tests for Identity Resolver, Onboarding Service, Roleplay Service
- [ ] Integration tests for API routes
- [ ] E2E tests for all 6 user state matrix scenarios

## Test Coverage Gaps (Still Need)

- Roleplay session creation/resumption
- Roleplay state transitions
- Invite validation/start/consume flow
- Audio upload/conversion
- QA evaluation claim/race conditions
- Entry router decision logic
- Onboarding state machine transitions

## Data Integrity Concerns (Phase 1 - Still Need Audit)

- Duplicate users across `rbac_users`, `user_profiles`, `interpreters`, `recruitment_candidates`
- Orphaned `UserProfile` records without linked `Interpreter`
- Orphaned `Interpreter` records without `UserProfile`
- Email inconsistencies (case sensitivity, duplicates)
- Roleplay sessions with invalid states
- RoleplayAccess tokens without proper expiration tracking

## Files Created/Modified

### New Files
- `src/lib/identity/resolve-user.ts` - Central identity resolver
- `src/services/onboarding/onboarding-service.ts` - Onboarding state machine & actions
- `src/app/(entry)/page.tsx` - Entry router (single navigation decision point)
- `scripts/audit-users.ts` - User identity audit script
- `scripts/audit-onboarding.ts` - Onboarding state audit script
- `scripts/audit-roleplays.ts` - Roleplay session audit script
- `BASELINE_ISSUES.md` - This file

### Modified Files
- `src/app/page.tsx` - Now redirects to `/entry`
- `src/lib/auth/actions.ts` - Added `getResolvedIdentity()` and `validateActionWithIdentity()`
- `src/app/dashboard/layout.tsx` - Removed heavy ranking computation
- `src/app/dashboard/page.tsx` - Removed OnboardingGate, admin redirect

### Ready for Next Phase

The foundation is now stable. Ready to proceed with Phase 5 (Roleplay Domain Service) and Phase 6 (Roleplay State Machine).