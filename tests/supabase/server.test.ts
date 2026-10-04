// Auto-generated test scaffold — review and expand before shipping

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @supabase/ssr before importing the module under test
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';

const mockCookieStore = {
  getAll: vi.fn().mockReturnValue([]),
  set: vi.fn(),
};

const mockClient = { from: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(cookies).mockReturnValue(mockCookieStore as any);
  vi.mocked(createServerClient).mockReturnValue(mockClient as any);
});

describe('createSupabaseServerClient', () => {
  it('creates a server client using the anon key', () => {
    const client = createSupabaseServerClient();

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(createServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      expect.objectContaining({ cookies: expect.any(Object) })
    );
    expect(client).toBe(mockClient);
  });

  it('passes cookie helpers that delegate to the cookie store', () => {
    createSupabaseServerClient();

    const [, , { cookies: cookieHelpers }] = vi.mocked(createServerClient).mock.calls[0] as any;

    // getAll should delegate to the cookie store
    cookieHelpers.getAll();
    expect(mockCookieStore.getAll).toHaveBeenCalledOnce();

    // setAll should call cookieStore.set for each cookie
    const cookiesToSet = [
      { name: 'a', value: '1', options: {} },
      { name: 'b', value: '2', options: {} },
    ];
    cookieHelpers.setAll(cookiesToSet);
    expect(mockCookieStore.set).toHaveBeenCalledTimes(2);
  });

  it('does not throw when setAll is called from a Server Component (read-only cookies)', () => {
    createSupabaseServerClient();

    const [, , { cookies: cookieHelpers }] = vi.mocked(createServerClient).mock.calls[0] as any;

    // Simulate the read-only cookies() error that Next.js throws in Server Components
    mockCookieStore.set.mockImplementationOnce(() => {
      throw new Error('cookies() was called in a context where it cannot be modified');
    });

    // setAll must swallow the error silently
    expect(() =>
      cookieHelpers.setAll([{ name: 'x', value: '1', options: {} }])
    ).not.toThrow();
  });
});

describe('createSupabaseAdminClient', () => {
  it('creates an admin client using the service role key', () => {
    const client = createSupabaseAdminClient();

    expect(createServerClient).toHaveBeenCalledOnce();
    expect(createServerClient).toHaveBeenCalledWith(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      expect.objectContaining({ cookies: expect.any(Object) })
    );
    expect(client).toBe(mockClient);
  });

  it('uses the service role key, not the anon key', () => {
    // Set both keys to distinct values so the comparison is meaningful
    const originalAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const originalService = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-test';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-test';

    try {
      createSupabaseAdminClient();
      const [, keyUsed] = vi.mocked(createServerClient).mock.calls[0] as any;
      expect(keyUsed).toBe('service-role-key-test');
      expect(keyUsed).not.toBe('anon-key-test');
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnon;
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalService;
    }
  });

  it('does not throw when setAll is called from a Server Component', () => {
    createSupabaseAdminClient();

    const [, , { cookies: cookieHelpers }] = vi.mocked(createServerClient).mock.calls[0] as any;

    mockCookieStore.set.mockImplementationOnce(() => {
      throw new Error('read-only cookies');
    });

    expect(() =>
      cookieHelpers.setAll([{ name: 'x', value: '1', options: {} }])
    ).not.toThrow();
  });
});
