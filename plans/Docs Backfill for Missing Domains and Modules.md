# Docs Backfill for Missing Domains and Modules

## Summary

Backfill `docs/` so it matches the new AGENTS policy using **single combined domain docs** where backend and frontend share the same business area. The result should be a decision-complete docs set that covers all current backend domain modules and all current top-level frontend feature modules, while preserving the existing `team-role-management.md` file as the canonical team/invite doc.

## Key Changes

- Create or update the docs set to this exact domain inventory:
  - `docs/auth.md`
  - `docs/customer.md`
  - `docs/dashboard.md`
  - `docs/inventory.md`
  - `docs/location.md`
  - `docs/order.md`
  - `docs/product.md`
  - `docs/audit-log.md`
  - `docs/health.md`
  - `docs/reports.md`
  - `docs/settings.md`
  - `docs/team-role-management.md` (update, do not replace)

- Use **combined domain docs** for overlapping backend/frontend areas:
  - `auth`, `dashboard`, `customer`, `inventory`, `location`, `order`, `product`, and `team/invite`
  - Each of these docs should describe both the backend module behavior and the frontend feature behavior in one file

- Use **backend-only docs** for backend domains with no corresponding frontend feature module:
  - `audit-log`
  - `health`

- Use **frontend-only docs** for top-level frontend features with no corresponding backend domain module:
  - `reports`
  - `settings`

- Do **not** create docs for technical/shared support areas that are not top-level feature modules:
  - `frontend/components/shared`
  - `frontend/components/ui`
  - `frontend/components/mock`
  - framework plumbing like `frontend/app/api/auth/*` as standalone docs
  - internal backend support folders outside `backend/src/domain/`

- Preserve and expand `docs/team-role-management.md` as the combined documentation for:
  - backend `team`
  - frontend `team`
  - frontend invite acceptance flow
  - backend invitation behavior

## Implementation Details

- For each doc, capture the **current implementation as it exists today**, not a speculative target design.
- Use `docs/team-role-management.md` as the structure/style reference and keep the docs concise but implementation-grounded.
- Each doc should include, where applicable:
  - Purpose and module boundaries
  - Main entities/state
  - Backend endpoints and route behavior
  - Frontend pages, key UI flows, and client/server data loading behavior
  - Permissions/access constraints
  - Business rules and notable edge cases
  - Testing coverage summary referencing existing unit/integration coverage patterns
- For combined docs, explicitly split content into backend and frontend subsections when needed to avoid ambiguity.
- For placeholder or thin features like `reports` and `settings`, document the current state honestly:
  - current route/page existence
  - present behavior and limitations
  - notable missing backend coupling if there is none yet
- Keep naming stable and singular/domain-oriented exactly as listed above so future updates continue to target the same files.

## Test / Verification Plan

- No production code changes are required for this task; this is a docs backfill/update pass.
- Verification should be:
  - confirm every backend domain under `backend/src/domain/` is represented by either a dedicated doc or a combined domain doc
  - confirm every top-level frontend feature route/module is represented by either a dedicated doc or a combined domain doc
  - confirm `docs/team-role-management.md` still exists and now covers both team management and invite behavior
  - confirm no duplicate parallel docs are introduced for the same domain
  - optionally run a quick markdown/path sanity pass to ensure internal file references remain valid

## Assumptions and Defaults

- The canonical coverage target is:
  - backend domains: `audit-log`, `auth`, `customer`, `dashboard`, `health`, `inventory`, `location`, `order`, `product`, `team`
  - frontend top-level features: `login/auth`, `dashboard`, `customers`, `inventory`, `locations`, `orders`, `products`, `team`, `invite`, `reports`, `settings`
- “Single combined domain doc” means one business-domain file may satisfy both the backend and frontend module requirement when they represent the same feature area.
- `team-role-management.md` remains the canonical team/invite doc instead of renaming it to `team.md`.
- `reports` and `settings` should receive docs because they are top-level frontend feature areas, even if their current implementation is thin.
