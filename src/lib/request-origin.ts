/** Compare the browser origin with the public Host, not Next's internal bind address.
 * APP_ORIGIN is authoritative behind a TLS-terminating reverse proxy. Forwarded
 * headers are deliberately not trusted without that explicit configuration.
 */
export function hasAllowedRequestOrigin(request: Request, configuredOrigin = process.env.APP_ORIGIN): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const source = new URL(origin);
    if (!/^https?:$/.test(source.protocol) || source.origin !== origin) return false;
    if (configuredOrigin) return source.origin === new URL(configuredOrigin).origin;
    const internal = new URL(request.url);
    const host = request.headers.get("host");
    if (host && /[\s,/@\\?#]/.test(host)) return false;
    const target = host ? new URL(`${internal.protocol}//${host}`) : internal;
    return source.origin === target.origin;
  } catch { return false; }
}
