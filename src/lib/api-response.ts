import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    totalPages?: number;
  };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function ok<T>(data: T, meta?: ApiSuccess<T>["meta"], status = 200): NextResponse {
  return NextResponse.json({ data, meta } satisfies ApiSuccess<T>, { status });
}

export function created<T>(data: T): NextResponse {
  return ok(data, undefined, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function err(code: string, message: string, status: number, details?: unknown): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } } satisfies ApiError,
    { status }
  );
}

export const Errors = {
  unauthorized: (msg = "Authentication required") => err("UNAUTHORIZED", msg, 401),
  forbidden: (msg = "Insufficient permissions") => err("FORBIDDEN", msg, 403),
  notFound: (msg = "Resource not found") => err("NOT_FOUND", msg, 404),
  badRequest: (msg: string, details?: unknown) => err("BAD_REQUEST", msg, 400, details),
  conflict: (msg: string) => err("CONFLICT", msg, 409),
  internal: (msg = "Internal server error") => err("INTERNAL_ERROR", msg, 500),
  scopeRequired: (scope: string) =>
    err("SCOPE_REQUIRED", `This action requires the '${scope}' scope`, 403),
};
