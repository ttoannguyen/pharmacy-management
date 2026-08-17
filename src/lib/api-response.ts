import { NextResponse } from "next/server";

export type ApiSuccess<T> = {
  status: "success";
  data: T;
  message: string;
  code: "OK";
  timestamp: string;
};

export type ApiError = {
  status: "error";
  data: null | Record<string, unknown>;
  message: string;
  code: string;
  timestamp: string;
};

export function apiSuccess<T>(data: T, message = "OK", status = 200) {
  return NextResponse.json<ApiSuccess<T>>({
    status: "success",
    data,
    message,
    code: "OK",
    timestamp: new Date().toISOString(),
  }, { status });
}

export function apiError(message: string, code: string, status: number, data: null | Record<string, unknown> = null, headers?: HeadersInit) {
  return NextResponse.json<ApiError>({
    status: "error",
    data,
    message,
    code,
    timestamp: new Date().toISOString(),
  }, { status, headers });
}
