# Project structure

/app            routes (auth, crews, feed, fits, events, checkin, settings, admin)
/components     reusable UI (ui/, feed/, crews/, fits/, chat/)
/lib            business logic, supabase clients, validators (zod), utils
/lib/security   rate limiting, content checks, audit logging
/supabase       migrations, seed data, RLS policies
/tests          unit and e2e
/docs           specs, privacy notes, moderation policy

Naming: kebab-case files, PascalCase components, camelCase functions. One feature = one folder under /lib and /components.
