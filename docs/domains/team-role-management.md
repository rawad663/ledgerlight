# Team Role Management

## Purpose and module boundaries

The team domain manages organization memberships, invite acceptance, role hierarchy, and location-scoped member access.

This doc covers:

- Backend `team` under `backend/src/domain/team`
- Frontend team management under `/team`
- Frontend invite acceptance under `/invite/[token]`

## Roles

| Role | Purpose | Team management |
| --- | --- | --- |
| `OWNER` | Full administrative access | Can manage every member, including other owners, subject to last-owner and self-protection rules |
| `MANAGER` | Full operational access | Can invite and manage lower-tier roles |
| `CASHIER` | Sales and fulfillment workflows | No team-management route access |
| `SUPPORT` | Read-only operational access | No team-management route access |
| `INVENTORY_CLERK` | Inventory-focused workflows | No team-management route access |

## Main entities and state

- `Membership`: the organization-scoped team row
- `MembershipLocation`: optional location-scope join records
- `InviteToken`: expiring acceptance token for invited memberships
- Membership statuses:
  - `INVITED`
  - `ACTIVE`
  - `DEACTIVATED`

## Backend behavior

### Endpoints

- `GET /team`
  - paginated member list with search, role, and status filters
- `GET /team/roles`
  - read-only role catalog used by the UI
- `GET /team/:membershipId`
  - member detail
- `POST /team/invite`
  - create or resend an invite-backed membership
- `PATCH /team/:membershipId`
  - update profile details
- `PATCH /team/:membershipId/role`
  - change a member role
- `PATCH /team/:membershipId/locations`
  - update location scope
- `POST /team/:membershipId/deactivate`
- `POST /team/:membershipId/reactivate`
- `POST /team/:membershipId/resend-invite`
- `POST /team/invitations/resolve`
  - public invite-token lookup
- `POST /team/invitations/accept`
  - public or authenticated invite acceptance flow

### Permissions

- Read team data: `USERS_READ`
- Mutating team state requires one of:
  - `USERS_INVITE`
  - `USERS_MANAGE`

### Permission model and tier rules

- Permissions are evaluated per organization membership through the org and permissions guards.
- `OWNER` retains the broadest management authority.
- `MANAGER` can invite and manage lower-tier roles.
- Team rows represent memberships, not global users.
- A user can hold different roles in different organizations.
- Owners can manage non-owner members by default.
- Managers can only assign or manage lower-tier roles.
- Self role changes and self deactivation are blocked.
- Demoting or deactivating the last active owner is blocked.
- Only owners can manage another owner.

### Location scoping

- Memberships can be scoped to a subset of locations through `MembershipLocation`.
- No assigned location rows means full organization access.
- Location scope is enforced for location-bound domains such as orders, inventory, inventory adjustments, dashboard metrics, and locations.
- Customers and products remain organization-scoped.

### Invitation behavior

- Invites create or reuse a membership, then issue an expiring invite token.
- `resolve` returns whether the token is `VALID`, `EXPIRED`, or `INVALID`.
- New users can set their password during invite acceptance.
- Existing authenticated users can accept using their current account when the invite matches.
- In non-production environments the generated invite URL is surfaced through the delivery fallback for easier local testing.

### Audit behavior

- Team mutations write audit entries for invite send/resend/accept, role changes, deactivation/reactivation, and location-scope updates.

## Frontend behavior

### Team management page

- `/team` is a private route rendered inside `AppShell`.
- The page is server-rendered and, when access is allowed, preloads:
  - `/locations`
  - `/team`
  - `/team/roles`
- Frontend route access is limited to `OWNER` and `MANAGER` through `canAccessTeam`.
- When the current role cannot access team management, the page renders a restricted-access state instead of the full management UI.

### Main UI flows

- Search, role, and status filters update the member list.
- Managers and owners can invite members, edit profile details, change roles, update location scope, resend invites, and deactivate/reactivate memberships when allowed by tier rules.
- UI helpers mirror backend tier rules so forbidden actions are hidden or disabled before the request is made.
- Final enforcement still happens on the backend.

### Invite acceptance page

- `/invite/[token]` is public.
- The page resolves the token, renders the correct state, and guides the user through:
  - accepting as a new user with password setup
  - accepting as an already authenticated matching user
- After acceptance, the app can refresh auth state through the frontend refresh plumbing so the new membership is available to the session.

## Testing coverage

- Backend team behavior is covered by controller and service tests plus backend integration coverage in `backend/test/integration/team.integration-spec.ts`.
- Frontend team management behavior is covered by Playwright tests in `frontend/test/integration/specs/team.integration.spec.ts`.
- Frontend invite behavior is covered by Playwright tests in `frontend/test/integration/specs/invite.integration.spec.ts`.
- Focused frontend logic coverage also exists in `frontend/components/team/invite-acceptance-page.test.tsx` and `frontend/components/team/team-utils.test.ts`.
