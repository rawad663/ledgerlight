import type { AxiosInstance, AxiosResponse } from "axios";

export function createAxiosMock(): jest.Mocked<
  Pick<AxiosInstance, "get" | "post">
> {
  return {
    get: jest.fn<Promise<AxiosResponse>, Parameters<AxiosInstance["get"]>>(),
    post: jest.fn<Promise<AxiosResponse>, Parameters<AxiosInstance["post"]>>(),
  };
}

export function makeAxiosResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: "OK",
    headers: {},
    config: {} as AxiosResponse["config"],
  };
}

export function makeAxiosError(
  status: number,
  message: string | string[],
): Error {
  const err = new Error(
    Array.isArray(message) ? message[0] : message,
  ) as Error & {
    isAxiosError: boolean;
    response: { status: number; data: { message: string | string[] } };
  };
  err.isAxiosError = true;
  err.response = { status, data: { message } };
  return err;
}
