// ============================================================
// Shared TypeScript types — Single Source of Truth
// Derived from the Supabase schema (migration_v2)
// ============================================================

export type UserRole = 'admin' | 'interpreter';
export type RealtimeStatus = 'Online' | 'Offline' | 'Busy';

export interface UserProfile {
  id: string;
  role: UserRole;
  interpreter_id: number | null;
  display_name: string;
  created_at: string;
}

export interface CallSession {
  id: number;
  interpreter_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  tariff_snapshot: number;
  call_cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface PayrateAuditEntry {
  id: number;
  interpreter_id: number;
  old_rate: number | null;
  new_rate: number;
  changed_by: string;
  changed_at: string;
}

export interface InterpreterWithStatus {
  id: number;
  externalId: string;
  name: string;
  status: string;
  realtime_status: RealtimeStatus;
  campaign: string | null;
  languageA: string;
  languageB: string;
  tariffPerMinute: number;
  emailCorporativo: string | null;
  pais: string | null;
}

// Generic action result wrapper
export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  code?: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'SERVICE_UNAVAILABLE' | 'CONFLICT' | 'INTERNAL_ERROR';
}

// Timer state stored in localStorage
export interface TimerLocalState {
  sessionId: number;
  startedAt: string; // ISO 8601
  interpreterId: number;
}
