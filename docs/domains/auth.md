# Auth

## Purpose and module boundaries

The auth domain owns sign-in, token refresh, logout, and the frontend session plumbing that turns backend tokens into browser cookies and protected page access.

This doc covers:

- Backend `auth` under `backend/src/domain/auth`
- Frontend login page, auth route handlers, middleware, and protected-route behavior

## Main entities and state

- `User`: the authenticated account
- `Membership`: the organization-scoped role context returned at login
- Access token: short-lived JWT used on authenticated API calls
- Refresh token: longer-lived secret used to mint a new access token
- Frontend auth cookies:
  - access token, readable by client code
  - refresh token, `httpOnly`
  - user id, `httpOnly`
  - current organization id, readable by client code

## Backend behavior

### Endpoints

- `POST /auth/login`
  - validates email and password
  - returns access token, refresh token, user data, and memberships
  - throttled to reduce brute-force attempts
- `POST /auth/refresh`
  - exchanges a valid refresh token for a new access token
  - returns the current user context
- `POST /auth/logout`
  - requires a valid access token
  - revokes active refresh tokens for the current user
  - returns `204 No Content`

### Business rules and edge cases

- Login fails when credentials are invalid.
- Refresh fails when the refresh token does not belong to the user or is no longer valid.
- Logout is server-backed token revocation, not just client cookie cleanup.

## Frontend behavior

### Pages and route handlers

- `/login` renders the main login experience.
- `/api/auth/login` proxies backend login and persists auth cookies.
- `/api/auth/logout` proxies backend logout and always clears auth cookies, even if the backend responds with an error.
- `/api/auth/refresh` reads refresh credentials from cookies and requests a new access token from the backend.

### Protected-route flow

- Private routes include `/`, `/orders`, `/customers`, `/products`, `/inventory`, `/locations`, `/team`, `/reports`, and `/settings`.
- Public routes include `/login` and `/invite/*`.
- `frontend/middlewares/auth.ts` redirects unauthenticated users to `/login?returnTo=...`.
- If an access token is missing or close to expiry, the middleware attempts a refresh before allowing the request through.
- If refresh fails, the middleware clears stale cookies and redirects back to login.
- Visiting `/login` with a still-valid access token redirects to `/`.

## Permissions and access

- Backend login and refresh are public endpoints.
- Backend logout requires an authenticated user.
- Frontend page access is enforced by the auth middleware first, then by feature-specific role checks where needed.

## Testing coverage

- Backend auth behavior is covered by unit tests and backend integration tests in `backend/test/integration/auth.integration-spec.ts`.
- Frontend auth behavior is covered by page-level Playwright tests in `frontend/test/integration/specs/auth.integration.spec.ts`.
- Frontend login UI behavior also has focused component coverage in `frontend/components/login/login-page.test.tsx`.
