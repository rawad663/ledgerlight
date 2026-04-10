export function shouldUseSecureCookies(url: URL | { protocol: string }) {
  return url.protocol === "https:";
}
