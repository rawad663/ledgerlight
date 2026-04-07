export const PRIVATE_ROUTES: string[] = [
  "/",
  "/orders",
  "/customers",
  "/products",
  "/inventory",
  "/locations",
  "/team",
  "/reports",
  "/settings",
];

export const PUBLIC_ROUTES: string[] = ["/login", "/invite"];

function matchesRoute(pathname: string, route: string): boolean {
  if (route === "/") {
    return pathname === route;
  }

  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_ROUTES.some((route) => matchesRoute(pathname, route));
}

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => matchesRoute(pathname, route));
}
