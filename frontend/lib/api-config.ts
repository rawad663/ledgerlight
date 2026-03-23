import type { paths } from "./api-types";

export const AUTH_HEADER_COOKIE_MAP = {
  ACCESS_TOKEN: "access_token",
  X_ORGANIZATION_ID: "x_organization_id",
};

/**
 * Strips `X-Organization-Id` from required operation headers,
 * since the client injects it via default headers.
 */
type WithoutOrgHeader<T> = T extends { parameters: infer P }
  ? P extends { header: infer H }
    ? Omit<T, "parameters"> & {
        parameters: Omit<P, "header"> & {
          header?: Omit<H, "X-Organization-Id">;
        };
      }
    : T
  : T;

export type ApiPaths = {
  [Path in keyof paths]: {
    [Method in keyof paths[Path]]: WithoutOrgHeader<paths[Path][Method]>;
  };
};
