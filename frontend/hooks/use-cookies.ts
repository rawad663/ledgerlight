import { useEffect, useState } from "react";

type CookieMap = Record<string, string>;

type SetCookieOptions = {
  path?: string;
  maxAge?: number;
  expires?: Date;
  sameSite?: "Lax" | "Strict" | "None";
  secure?: boolean;
  domain?: string;
};

// "theme=dark; session_id=abc123; user=rawad"
function parseCookieString(cookieString: string): CookieMap {
  const cookieList = cookieString.split("; ");
  const cookieObject = cookieList.reduce((acc, pair) => {
    const eqIndex = pair.indexOf("=");
    if (eqIndex === -1) return acc;

    const key = decodeURIComponent(pair.slice(0, eqIndex).trim());
    const value = decodeURIComponent(pair.slice(eqIndex + 1).trim());

    acc[key] = value;

    return acc;
  }, {} as CookieMap);

  return cookieObject;
}

function buildCookieString(
  name: string,
  value: string,
  options: SetCookieOptions = {},
) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`];

  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  if (options.domain) parts.push(`Domain=${options.domain}`);

  return parts.join("; ");
}

export function useCookies() {
  const [cookies, setCookies] = useState<Record<string, string>>({});

  const refreshCookies = () => {
    setCookies(parseCookieString(document.cookie));
  };

  useEffect(() => {
    refreshCookies();
  }, []);

  const getCookie = (name: string) => cookies[name];

  const setCookie = (
    name: string,
    value: string,
    options: SetCookieOptions = {},
  ) => {
    // document.cookie is a getter/setter so this won't overwrite the cookie string
    document.cookie = buildCookieString(name, value, {
      path: "/",
      sameSite: "Lax",
      ...options,
    });
    refreshCookies();
  };

  const removeCookie = (name: string, path = "/") => {
    document.cookie = `${encodeURIComponent(name)}=; Path=${path}; Max-Age=0`;
    refreshCookies();
  };

  return {
    cookies,
    getCookie,
    setCookie,
    removeCookie,
    refreshCookies,
  };
}
