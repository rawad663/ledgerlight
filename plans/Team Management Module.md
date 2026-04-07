# Team Management Module Plan

## Summary
- Build a full team-management system where the team row represents an organization `Membership`, not a global `User`.
- Deliver the spec end to end: members list, read-only roles tab, tier-constrained invite/manage flows, location-scoped access, invite acceptance, audit logging, and documentation.
- Use these locked decisions:
  - Invite delivery uses a dev-safe fallback: generate secure invite URLs, route them through a delivery adapter, and expose/log the link in non-production.
  - Customers remain organization-scoped; location scope applies to location-bound domains.
  - Roles tab is fully read-only this round.

## Public API, Data Model, and Type Changes
- Prisma:
  - Add `MembershipStatus` enum: `INVITED | ACTIVE | DEACTIVATED`.
  - Extend `Membership` with `status` and timestamps needed for invite/activation/deactivation tracking.
  - Add `MembershipLocation` join table; empty set means “all locations”.
  - Add `InviteToken` table with `membershipId`, `tokenHash`, `expiresAt`, `acceptedAt`, `createdAt`; resend expires prior unused tokens.
  - Make `User.passwordHash` nullable so newly invited users can exist before setting a password.
  - Extend `AuditAction` with explicit team events such as invite sent/resend/accepted, role changed, deactivated/reactivated, and location scope changed.
- Permissions/constants:
  - Add `Permission.USERS_INVITE`.
  - Add `ROLE_TIER` and shared helpers for `canAssignRole`, `canManageMember`, `canAssignLocations`.
  - Grant `USERS_INVITE` to `MANAGER`; keep `USERS_MANAGE` effectively owner-only via wildcard.
- Request/auth types:
  - Enrich JWT memberships and `CurrentOrg` with `membershipId`, `allowedLocationIds`, and `hasAllLocations`.
  - Only `ACTIVE` memberships go into login/refresh JWT payloads.
- HTTP endpoints:
  - `GET /team` for paginated members, stats, and filter/sort support.
  - `GET /team/roles` for role catalog, descriptions, permission summaries, and per-role member counts.
  - `GET /team/:membershipId` for member detail plus recent activity.
  - `POST /team/invite`
  - `PATCH /team/:membershipId`
  - `PATCH /team/:membershipId/role`
  - `PATCH /team/:membershipId/locations`
  - `POST /team/:membershipId/deactivate`
  - `POST /team/:membershipId/reactivate`
  - `POST /team/:membershipId/resend-invite`
  - `POST /team/invitations/resolve`
  - `POST /team/invitations/accept`

## Implementation Changes
- Backend:
  - Add a dedicated team domain module with DTOs, controller, service, and policy helpers.
  - Implement members list search, status/role filters, sortable columns, summary stats, and default view of `ACTIVE + INVITED`.
  - Enforce tier rules on invite, role change, deactivate/reactivate, and self-protection; block self role changes, self deactivation, and deactivation/demotion of the last owner.
  - Support invite branching:
    - New user: create user + invited membership + token, set password during acceptance.
    - Existing user in another org: create invited membership, require login before acceptance.
    - Existing deactivated membership: reactivate/update instead of duplicating.
  - Extend `OrganizationContextGuard` to inject location scope and apply it to orders, inventory, inventory adjustments, locations, and any dashboard/location-picker data that is location-derived.
  - Keep customers and products org-scoped.
  - Centralize audit writes so every team mutation records before/after snapshots against the target user/member.
- Frontend:
  - Replace the `/team` placeholder with a real page using the existing table/filter/pagination patterns.
  - Add `Members` and `Roles` tabs, stat cards, debounced URL-synced search, row menus, and tier-aware action visibility.
  - Add right-side drawers for invite, member detail, and edit flows; confirmation dialogs for role changes and deactivation; success/error toasts; optimistic insert for sent invites with rollback on failure.
  - Add a public invite acceptance route such as `/invite/[token]` that resolves the token, lets new users set a password, and prompts existing users to log in before accepting.
  - Hide or deny Team navigation for roles without `users.read`.
  - Regenerate `frontend/lib/api-types.ts` after Swagger changes.
- Docs:
  - Add a short README section summarizing roles, team permissions, tier rules, and location scoping.
  - Add a deeper root doc at `docs/team-role-management.md` and link it from `README.md`.

## Test Plan
- Backend unit/controller tests:
  - `ROLE_TIER` and permission matrix coverage, including `USERS_INVITE`.
  - Invite happy path, duplicate existing-org member, existing-user cross-org invite, deactivated-member reinvite, expired token, resend flow, acceptance flow, and invalid token cases.
  - Manager tier enforcement, self-protection, and last-owner protection.
  - Location assignment intersection with actor scope.
  - Auth login/refresh excluding non-active memberships and carrying location scope in JWT/context.
  - Scoped order/inventory/location queries and blocked writes outside allowed locations.
  - Audit log creation for every team mutation.
- Frontend tests:
  - Members tab filtering/sorting/search behavior, row action visibility by role/status, optimistic invite row, rollback on API failure, and drawer/dialog flows.
  - Roles tab rendering and permission summaries.
  - Invite acceptance page states: valid new-user token, existing-user login-required, expired token, invalid token.
  - Navigation visibility for unauthorized roles.
- Verification:
  - Run full backend Jest suite and frontend Vitest suite.
  - Regenerate OpenAPI types and confirm `/team` and invite acceptance flows work against the updated API.

## Assumptions and Defaults
- Team routes use `membershipId` as the primary identifier; activity logs are shown by filtering the target user/member audit trail.
- Roles/descriptions remain code-defined and read-only in the UI.
- “All locations” is represented by zero `MembershipLocation` rows.
- Dev/test invite delivery returns or logs the generated invite URL; the delivery service is intentionally pluggable for later SMTP/provider integration.
- Existing users accept org invites by logging in first; new users accept by setting their password during invite acceptance.
