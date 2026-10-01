import { vi, expect } from 'vitest';

// Make expect globally available
(globalThis as any).expect = expect;
(globalThis as any).vi = vi;

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    has: vi.fn(),
  }),
  headers: () => new Headers(),
}));

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    channel: () => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn((cb) => cb('SUBSCRIBED', null)),
      track: vi.fn(),
      untrack: vi.fn(),
      unsubscribe: vi.fn(),
      presenceState: () => ({}),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  default: {
    userProfile: {
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      create: vi.fn(),
    },
    interpreter: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    productionLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
    qaScores: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    callSession: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb({
      userProfile: { update: vi.fn(), findUnique: vi.fn() },
      interpreter: { update: vi.fn(), findUnique: vi.fn() },
      productionLog: { create: vi.fn(), createMany: vi.fn() },
      callSession: { update: vi.fn() },
      interpreterStatusLog: { create: vi.fn() },
      payrateAuditLog: { create: vi.fn() },
    })),
  },
}));

// Mock next-auth
vi.mock('@/lib/auth-rbac', () => ({
  auth: vi.fn().mockResolvedValue(null),
  signOut: vi.fn(),
}));

// Mock crypto for uuid
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  },
});

// Suppress console.error in tests unless explicitly needed
const originalError = console.error;
console.error = (...args) => {
  if (args[0]?.includes?.('Warning:')) return;
  originalError.apply(console, args);
};