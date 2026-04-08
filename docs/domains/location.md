# Location

## Purpose and module boundaries

The location domain manages the physical or logical operating sites that inventory, orders, dashboard metrics, and membership location scopes depend on.

This doc covers:

- Backend `location` under `backend/src/domain/location`
- Frontend location management under `/locations`

## Main entities and state

- `Location`
- Location status, including active and archived states
- Location type and searchable metadata such as name, code, address, and city

## Backend behavior

### Endpoints

- `GET /locations`
  - paginated list with search, status, and type filters
- `GET /locations/:id`
  - individual location detail
- `POST /locations`
  - create a location
- `PATCH /locations/:id`
  - update location metadata or archive it
- `DELETE /locations/:id`
  - delete/archive path with business-rule protection

### Permissions

- Read: `LOCATIONS_READ`
- Create: `LOCATIONS_CREATE`
- Update: `LOCATIONS_UPDATE`
- Archive/delete: `LOCATIONS_ARCHIVE`

### Business rules and edge cases

- All location queries are organization-scoped and may be filtered by the actor's allowed locations.
- Duplicate names or codes are rejected.
- Archiving is blocked when a location still has inventory on hand.
- Deletion is blocked for protected states such as the only organization location, locations with inventory, or locations with historical references.

## Frontend behavior

### Pages and data loading

- `/locations` server-loads:
  - the main filtered list
  - active count
  - archived count
  - overall operational count

### Main UI flows

- Filter controls support search, status, and type.
- The page shows status cards for total, active, and archived counts.
- Create and edit flows reuse location forms and refresh the list on success.
- Delete/archive paths surface backend conflict errors directly.

## Testing coverage

- Backend location behavior is covered by service/controller tests and backend integration tests in `backend/test/integration/location.integration-spec.ts`.
- Frontend location behavior is covered by Playwright page-level tests in `frontend/test/integration/specs/locations.integration.spec.ts`.
