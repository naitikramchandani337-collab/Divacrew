/**
 * Smoke test — verifies the test environment is set up correctly.
 * This file can be removed once real tests are added.
 */
import { describe, it, expect } from 'vitest';

describe('Test environment', () => {
  it('should resolve path aliases', async () => {
    // Verify the @ alias resolves — importing a module via @/ path
    const { createSupabaseBrowserClient } = await import('@/lib/supabase/client');
    expect(typeof createSupabaseBrowserClient).toBe('function');
  });
});
