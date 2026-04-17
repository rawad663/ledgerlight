# Frontend Conventions

## Goals

- Preserve working behavior while improving structure.
- Prefer shared domain utilities over local helper duplication.
- Keep feature code easy to scan and easy to extend.

## Naming

- Exported feature component prop types should be explicit: `OrdersPageProps`, `EditOrderFormProps`, `MockFeaturePageProps`.
- Hooks must use the `use*` naming convention.
- Transformed display types should describe their role, not look like prop types.
  - Good: `ProductRowViewModel`
  - Avoid: `ProductProp`
- Shared formatter names live in `lib/formatters.ts`.
- Shared status display config lives in `lib/status.ts`.

## Feature Structure

- Route files in `app/` should stay thin and focus on server data loading plus top-level composition.
- Route files in `app/` should use the shared `createApi()` server client instead of feature-specific fetch wrappers.
- Feature pages should compose shared building blocks instead of recreating headers, search bars, pagination, and status helpers inline.
- When a page needs drawers, dialogs, forms, tabs, or other dense feature sections, extract them into feature subcomponents instead of defining page-sized helper components inline.
- Non-trivial forms should use `react-hook-form` with Zod.
- Reusable feature UI belongs in `components/shared/` or feature subcomponents, not inside long page files when it is reused or too dense to scan.

## Shared Utilities

- Client components should use `useApiClient()` or shared API hooks instead of feature-specific request wrapper modules.
- Feature type aliases should come from generated DTOs in `lib/api-types.ts` instead of hand-maintained copies of backend response shapes.
- Use `lib/formatters.ts` for:
  - money formatting
  - date formatting
  - enum labels
  - order ID formatting
  - initials
- Use `lib/status.ts` for shared display styles and shared status-label logic.
- Use `hooks/use-locations.ts` for location list fetching instead of repeating the `/inventory/levels` bootstrap request in multiple forms.

## Mock Data

- Incomplete pages must render from explicit mock modules under `lib/mocks/`.
- Do not define page-sized mock arrays inline inside page components.
- Mock-backed pages should look intentional and realistic, but must stay clearly isolated from live backend behavior.

## Lint and Tests

- ESLint enforces import sorting, unused code cleanup, explicit prop type names in feature code, and bans the old placeholder-page pattern.
- Shared utilities and new feature abstractions should ship with focused tests when they materially affect behavior.
- Keep `lint`, `test:run`, and `build` passing throughout the refactor.
