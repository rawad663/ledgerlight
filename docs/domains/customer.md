# Customer

## Purpose and module boundaries

The customer domain manages organization-scoped customer records used by the orders workflow and dashboard rollups.

This doc covers:

- Backend `customer` under `backend/src/domain/customer`
- Frontend customer list and CRUD flows under `/customers`

## Main entities and state

- `Customer`
- Customer status, including active and inactive records
- Customer order history and spend totals surfaced in detail/list responses

## Backend behavior

### Endpoints

- `GET /customers`
  - paginated list
  - supports search and status filtering
- `GET /customers/:id`
  - returns the organization-scoped customer detail
- `POST /customers`
  - creates a new customer record
- `PATCH /customers/:id`
  - updates customer fields
- `DELETE /customers/:id`
  - removes the customer from active use

### Permissions

- Read: `CUSTOMERS_READ`
- Create: `CUSTOMERS_CREATE`
- Update: `CUSTOMERS_UPDATE`
- Delete: `CUSTOMERS_DELETE`

### Business rules and edge cases

- All customer queries are organization-scoped.
- Missing records return not found.
- New customers default into an active state.
- Delete is modeled as a business-level deactivation/inactivation path rather than a simple unconstrained hard delete from the UI perspective.

## Frontend behavior

### Pages and data loading

- `/customers` is a server-rendered page that loads the first customer page through `createApi()`.
- Search and status query params are forwarded into the initial request.
- The page renders inside `AppShell` and hands the initial result to `CustomersPage`.

### Main UI flows

- Search and filtering update the visible list.
- Create customer opens a form flow and refreshes the list on success.
- Edit customer updates an existing record in place.
- Delete customer removes the row from the active list and preserves empty-state behavior.

## Permissions and access

- Backend enforcement happens through permission decorators.
- Frontend access depends on a valid authenticated session; there is no extra route-level role gate beyond backend permission enforcement.

## Testing coverage

- Backend customer logic is covered by service/controller tests and backend integration tests in `backend/test/integration/customer.integration-spec.ts`.
- Frontend customer behavior is covered by Playwright page-level tests in `frontend/test/integration/specs/customers.integration.spec.ts`.
