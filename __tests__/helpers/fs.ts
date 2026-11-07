type Fs = { readFileSync: (path: string, encoding: string) => string };

const { process } = globalThis as unknown as {
  process: { getBuiltinModule: (name: string) => unknown; cwd: () => string };
};

/** Reads a file relative to the project root. */
export function readFileSync(path: string): string {
  return (process.getBuiltinModule('node:fs') as Fs).readFileSync(`${process.cwd()}/${path}`, 'utf8');
}
