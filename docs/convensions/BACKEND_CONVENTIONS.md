# Backend Conventions

## Goals

- Maintain strict multi-tenant data isolation across all operations.
- Keep controllers thin and services thick — business logic never lives in route handlers.
- Every mutation is auditable and every feature is test-covered.
- Follow established module patterns so new features are predictable and scannable.

## Module Structure

- Domain modules live in `src/domain/[name]/`.
- Each module contains: `[name].module.ts`, `[name].controller.ts`, `[name].service.ts`, `[name].dto.ts`.
- Each module has test files: `[name].service.spec.ts`, `[name].controller.spec.ts`.
- Register every new module in `app.module.ts` imports.
- Modules import `PrismaModule` and any cross-domain modules they depend on.
- Shared infrastructure lives in `src/common/` (decorators, guards, filters, interceptors, middlewares, DTOs, permissions, organization utilities, swagger helpers).

## Controllers

- Apply `@OrgProtected()` at the class level for all organization-scoped controllers.
- Apply `@RequirePermissions()` or `@RequireAnyPermission()` on every method — the permissions guard default-denies undeclared routes.
- Use `@CurrentOrganization()` to extract the verified org context; pass it to service methods via `toOrganizationScopeInput(org)`.
- Use `@ApiDoc()` for Swagger documentation instead of composing raw `@ApiOperation` + `@ApiResponse`.
- Use `appendToPaginationQuery()` when documenting paginated GET endpoints.
- Use `@ApiTags()` at the class level to group endpoints in Swagger.
- Controllers must not contain business logic, database calls, or conditional branching beyond permission gate checks.

## Services

- Mark as `@Injectable()`.
- Inject `PrismaService` directly — there is no repository abstraction.
- Accept organization scope as first parameter: `organization: CurrentOrg | string`.
- Normalize with `resolveOrganizationScope(organization)` at the top of every method.
- Always include `organizationId` in Prisma where clauses for tenant data.
- Use compound unique keys where available (e.g., `id_organizationId`) for `findUnique`/`update`/`delete`.
- For paginated queries, use `PrismaService.paginateMany()` and return `{ data, totalCount, nextCursor }`.
- Wrap multi-step operations in `this.prismaService.$transaction(async (tx) => { ... })`.

### Location Scoping

- Use `hasRestrictedLocations(org)` to check if the user has location restrictions.
- Use `getLocationScopeWhere(org)` to add location filtering to Prisma where clauses.
- Use `ensureLocationAccessible(org, locationId, options)` to validate access to a specific location.
- When a member has restricted locations, queries must filter by their `allowedLocationIds`.
- Unrestricted members (`hasAllLocations: true`) see all data within the organization.

## DTOs and Validation

- Define all DTOs in `[name].dto.ts`.
- Use class-validator decorators: `@IsUUID`, `@IsString`, `@IsInt`, `@IsEnum`, `@IsOptional`, `@Min`, etc.
- Use class-transformer: `@Type(() => Number)` for query params, `@Transform()` for boolean coercion.
- Use `@ApiProperty()` for enums and nested types that Swagger cannot infer.
- Create input DTOs using `PickType` or `OmitType` from `@nestjs/swagger` based on the base entity DTO.
- Pagination query DTOs extend `PaginationOptionsQueryParamDto`.
- Paginated response DTOs extend `createPaginatedResponseDto(ItemDto)`.
- The global ValidationPipe is configured with `whitelist: true` and `forbidNonWhitelisted: true` — unknown properties are rejected.

## Database and Prisma

- Schema lives in `backend/prisma/schema.prisma`.
- Generate client after schema changes: `npx prisma generate`.
- Create migrations: `npx prisma migrate dev --name descriptive_snake_case_name`.
- Never edit migration SQL files after they have been applied.
- All business entities have `organizationId` as a foreign key to Organization.
- Use composite unique constraints for org-scoped uniqueness (e.g., `@@unique([organizationId, sku])`).
- Add `@@index` annotations for columns frequently used in where clauses or sorts.
- Money is stored as integer cents (`priceCents`, `totalCents`) — never as floats or decimals.

## Error Handling

- Services throw NestJS HTTP exceptions: `NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`.
- The global `AllExceptionsFilter` maps Prisma errors to HTTP status codes:
  - `P2025` (record not found) -> 404
  - `P2002` (unique constraint violation) -> 409
  - Other Prisma errors -> 400
- All error responses include: `statusCode`, `message`, `path`, `requestId`, `timestamp`.
- Internal server errors (500) never leak implementation details.

## Audit Logging

- Every write operation (create, update, delete, status change) must create an audit log entry.
- Audit logs capture: `organizationId`, `actorUserId`, `entityType`, `entityId`, `action`, `beforeJson`, `afterJson`.
- Use `AuditAction` enum values: `CREATE`, `UPDATE`, `DELETE`, `STATUS_CHANGE`, `INVENTORY_ADJUST`, etc.
- Use `AuditEntityType` enum values: `USER`, `MEMBERSHIP`, `CUSTOMER`, `PRODUCT`, `ORDER`, etc.
- Audit log creation should happen inside the same transaction as the mutation when possible.

## Authentication and Authorization

- Guard chain: `JwtAuthGuard` -> `OrganizationContextGuard` -> `PermissionsGuard` (composed by `@OrgProtected()`).
- Organization ID is passed via `X-Organization-Id` header.
- User memberships are embedded in the JWT payload (15-minute expiry).
- Permissions are defined in `src/common/permissions/permissions.ts`.
- Role-to-permission mapping is in `src/common/permissions/role-permissions.ts`.
- Role tier hierarchy is in `src/common/permissions/role-tier.ts`.
- To add a new permission: add to `permissions.ts`, then grant to appropriate roles in `role-permissions.ts`.
- `OWNER` has wildcard (`*`) permission — never enumerate OWNER's permissions explicitly.
- Rate limiting: global 100 req/min via `@nestjs/throttler`; login has a stricter 5/15min limit.

## Testing

- Framework: Jest 30 with ts-jest transform.
- Path alias: `@src/` -> `src/`, `@prisma/generated/client` -> mock.
- Setup: `src/test-utils/setup.ts` (sets default env vars, imports reflect-metadata).

### Service Tests

- Mock PrismaService with `createPrismaMock()` from `test-utils/prisma.mock.ts`.
- Use `Test.createTestingModule()` from `@nestjs/testing` for DI setup.
- Transaction mocking: `const tx = createPrismaMock(); const prisma = createPrismaMock(tx);`
- Test business logic branches: happy path, validation errors, not-found, permission denials, location restrictions.
- When passing a plain string orgId, `resolveOrganizationScope` defaults to OWNER with `hasAllLocations: true`.
- To test location-restricted behavior, pass a full `CurrentOrg` object:
  ```typescript
  { membershipId: 'mem-1', organizationId: 'org-1', role: Role.CASHIER, hasAllLocations: false, allowedLocationIds: ['loc-1'] }
  ```

### Controller Tests

- Mock the service entirely, verify delegation and error propagation.
- Test that correct decorators are applied (permissions, org protection).

## Naming

- Service methods: `createX`, `getX`, `getXById`, `updateX`, `deleteX`, `transitionStatus`.
- DTOs: `XDto` (base), `CreateXDto`, `UpdateXDto`, `GetXsQueryDto`, `GetXsResponseDto`.
- Controller methods match service methods: `createX`, `getX`, `getXById`, etc.
- Spec files: `[name].service.spec.ts`, `[name].controller.spec.ts`.

## Lint and Build

- ESLint + Prettier for formatting.
- All three must pass: `npm run lint`, `npm run test:run`, `npm run build`.
- Prettier runs automatically; use `npm run format` to fix formatting issues.
