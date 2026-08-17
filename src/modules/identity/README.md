# Identity module

P1.1 owns application authentication with Prisma and PostgreSQL. Supabase is used
only as the hosted database provider; it is not an authentication authority.

P1.2 resolves the active tenant from the authenticated user and active
`Membership`. The selected store is kept in an httpOnly cookie only as a
preference; every request re-checks the membership and store status in Prisma.

## Rules

- Passwords are stored only as Argon2id hashes.
- The browser receives an opaque random session token in a server-set cookie.
- The database stores only SHA-256 of the session token, never the raw token.
- Production cookie uses `__Host-pharmacy_session`, `HttpOnly`, `Secure`,
  `SameSite=Lax`, `Path=/` and an eight-hour expiry.
- Session rows are revocable and expire server-side.
- Login failures are rate-limited per HMAC(email + IP) key using `AUTH_PEPPER`.
- Login errors do not reveal whether an email exists.
- `User.externalAuthId` is nullable legacy/provider linkage; local auth uses email
  and `passwordHash`.
- Membership, active store and role resolution belong to P1.2.
- Role authorization uses explicit permissions; a matching role is not enough
  without the active store context and resource tenant check.

## Flow

```text
POST /api/auth/login
  -> validate input
  -> check persisted rate limit
  -> find user by normalized email
  -> verify Argon2id password
  -> create AuthSession with token hash
  -> set secure cookie

GET /api/auth/me or protected page
  -> hash cookie token
  -> find non-revoked, non-expired AuthSession
  -> load local User
```

## Files

- `application/password.ts`: Argon2id hash/verify.
- `application/session.ts`: opaque cookie session creation, lookup and revoke.
- `infrastructure/prisma-local-auth-repository.ts`: credential verification and
  persistent rate limiting.
- `src/app/api/auth/login`: login route.
- `src/app/api/auth/logout`: server-side revoke route.
- `src/app/api/auth/me`: authenticated local-user route.
