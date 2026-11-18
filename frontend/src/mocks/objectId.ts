/**
 * Creates a MongoDB-compatible 24-character ObjectId for browser preview data.
 * Random bytes keep IDs unique across reloads; a module counter is unsafe because
 * it restarts when the application is refreshed.
 */
export function createMockObjectId(usedIds?: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const bytes = new Uint8Array(12);
    const cryptoApi = globalThis.crypto;

    if (cryptoApi?.getRandomValues) {
      cryptoApi.getRandomValues(bytes);
    } else {
      for (let index = 0; index < bytes.length; index += 1) {
        bytes[index] = Math.floor(Math.random() * 256);
      }
    }

    const id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    if (!usedIds?.has(id)) return id;
  }

  throw new Error("Unable to generate a unique mock ObjectId");
}
