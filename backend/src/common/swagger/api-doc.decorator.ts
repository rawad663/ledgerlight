import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

type ValueConstructor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | DateConstructor
  | (new (...args: any[]) => any);

export type ApiQueryConfig = {
  name: string;
  required?: boolean;
  type?: ValueConstructor;
  description?: string;
  example?: any;
  enum?: Array<string | number>;
  deprecated?: boolean;
};

export type ApiParamConfig = ApiQueryConfig & { in?: 'path' | 'query' };

export type ApiResponseHeader = {
  name: string;
  description?: string;
  schema?: { type: string; format?: string; enum?: any[] };
  example?: any;
};

export type ApiDocOptions = {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  // When true, applies bearer auth + 401. When 'org' or 'roles', also implies 403 where relevant
  auth?: boolean | 'org' | 'roles';
  ok?: Type<any> | [Type<any>];
  created?: Type<any>;
  noContent?: boolean;
  body?: Type<any>;
  params?: ApiParamConfig[];
  queries?: ApiQueryConfig[];
  responseHeaders?: ApiResponseHeader[];
  badRequestDesc?: string;
  notFoundDesc?: string;
  conflictDesc?: string;
};

export function ApiDoc(opts: ApiDocOptions) {
  const decs: Array<ClassDecorator | MethodDecorator> = [];

  if (opts.summary || opts.description || opts.operationId || opts.tags) {
    decs.push(
      ApiOperation({
        summary: opts.summary,
        description: opts.description,
        operationId: opts.operationId,
        tags: opts.tags,
      }),
    );
  }

  if (opts.body) {
    decs.push(ApiBody({ type: opts.body }));
  }

  if (opts.params) {
    for (const p of opts.params) {
      decs.push(
        ApiParam({
          name: p.name,
          required: p.required ?? true,
          type: p.type,
          description: p.description,
          enum: p.enum,
          deprecated: p.deprecated,
        }),
      );
    }
  }

  if (opts.queries) {
    for (const q of opts.queries) {
      decs.push(
        ApiQuery({
          name: q.name,
          required: q.required ?? false,
          type: q.type,
          description: q.description,
          enum: q.enum,
          deprecated: q.deprecated,
        }),
      );
    }
  }

  if (opts.ok) {
    const isArray = Array.isArray(opts.ok);
    decs.push(
      ApiOkResponse({
        description: 'Successful response',
        type: isArray ? (opts.ok as [Type<any>])[0] : (opts.ok as Type<any>),
        isArray,
      }),
    );
  }

  if (opts.created) {
    decs.push(
      ApiCreatedResponse({
        description: 'Resource created',
        type: opts.created,
      }),
    );
  }

  if (opts.noContent) {
    decs.push(ApiNoContentResponse({ description: 'No content' }));
  }

  if (opts.responseHeaders && opts.responseHeaders.length) {
    // Attach headers on a generic 200 response to avoid overriding previous ApiOkResponse
    const headers = Object.fromEntries(
      opts.responseHeaders.map((h) => [
        h.name,
        {
          description: h.description,
          schema: h.schema ?? { type: 'string' },
        },
      ]),
    );
    decs.push(ApiResponse({ status: HttpStatus.OK, headers }));
  }

  // Standard errors
  if (opts.badRequestDesc !== null) {
    decs.push(
      ApiBadRequestResponse({
        description: opts.badRequestDesc ?? 'Validation failed',
      }),
    );
  }

  if (opts.notFoundDesc) {
    decs.push(ApiNotFoundResponse({ description: opts.notFoundDesc }));
  }

  if (opts.conflictDesc) {
    decs.push(ApiConflictResponse({ description: opts.conflictDesc }));
  }

  if (opts.auth) {
    decs.push(ApiBearerAuth());
    decs.push(
      ApiResponse({
        status: HttpStatus.UNAUTHORIZED,
        description: 'Unauthorized',
      }),
    );

    if (opts.auth === 'org' || opts.auth === 'roles') {
      decs.push(
        ApiForbiddenResponse({
          description: 'Missing or invalid organization context or role',
        }),
      );
    }
  }

  return applyDecorators(...decs);
}

export function appendToPaginationQuery(queryParams: ApiQueryConfig[]) {
  return [
    {
      name: 'limit',
      description: 'Max items per page (1-100)',
      type: Number,
    },
    { name: 'cursor', description: 'Pagination cursor', type: String },
    { name: 'sortBy', description: 'Sort field', type: String },
    {
      name: 'sortOrder',
      description: 'Sort direction',
      enum: ['asc', 'desc'],
      type: String,
    },
    ...queryParams,
  ];
}
