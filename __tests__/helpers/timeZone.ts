const { process: sandbox } = globalThis as unknown as { process: { getBuiltinModule: (name: string) => unknown } };

/**
 * Runs a test file's dates in another time zone. Jest gives each file a copy of process.env, so setting TZ
 * there does nothing; the real process is reached through getBuiltinModule, and Node rereads TZ when it
 * changes. Call at the top of a describe block.
 */
export function useTimeZone(zone: string): void {
  const real = sandbox.getBuiltinModule('node:process') as { env: Record<string, string | undefined> };
  let before: string | undefined;
  beforeAll(() => {
    before = real.env.TZ;
    real.env.TZ = zone;
  });
  afterAll(() => {
    if (before === undefined) {
      delete real.env.TZ;
    } else {
      real.env.TZ = before;
    }
  });
}
