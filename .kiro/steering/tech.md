# Tech stack and conventions

- Next.js (App Router) + TypeScript (strict mode) + Tailwind CSS. Mobile-first, installable PWA.
- Supabase: Postgres, Auth (phone OTP), Row Level Security on EVERY table, Realtime for chat, Storage for images.
- Zod for validation on all inputs (client and server).
- Server Actions or route handlers for mutations. No direct DB writes from untrusted client paths without RLS.
- Testing: Vitest for unit tests, Playwright for key flows.
- Environment secrets only in env vars, never in code or logs.
- Accessibility: semantic HTML, keyboard navigable, sufficient contrast, alt text for images.
- Every new table needs: RLS policies, indexes for common queries, created_at/updated_at, and soft-delete where users can delete content.
- Write small, composable components. Keep business logic in /lib, not in components.
