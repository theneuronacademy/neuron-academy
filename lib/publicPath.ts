// Client-safe helper (no server imports): the public website adds
// `view=public` to its content reads so they can be served from the CDN.
// See lib/publicView.ts for what the parameter does on the server.

/** Add `view=public` to a same-site API path. */
export function publicPath(path: string): string {
  return path + (path.includes("?") ? "&" : "?") + "view=public";
}
