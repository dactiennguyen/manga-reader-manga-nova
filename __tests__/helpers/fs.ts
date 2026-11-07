type Fs = {
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string, options: { recursive: boolean }) => string[];
};

const { process } = globalThis as unknown as {
  process: { getBuiltinModule: (name: string) => unknown; cwd: () => string };
};

/** Reads a file relative to the project root. */
export function readFileSync(path: string): string {
  return (process.getBuiltinModule('node:fs') as Fs).readFileSync(`${process.cwd()}/${path}`, 'utf8');
}

/** Every file under a folder of the project, as paths from the project root. */
export function listFiles(dir: string): string[] {
  const fs = process.getBuiltinModule('node:fs') as Fs;
  return fs.readdirSync(`${process.cwd()}/${dir}`, { recursive: true }).map(name => `${dir}/${name}`);
}
