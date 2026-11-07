import type { ID } from '../core/model/types';

/** Work that needs the data layer, wired by src/app so screens never import it. */
export type Services = {
  exportProject: (projectId: ID) => Promise<string>;
  importProject: (archivePath: string) => Promise<ID>;
  testAiConnection: (config: { baseUrl: string; apiKey: string; model: string }) => Promise<string>;
};

let services: Services | null = null;

export function configureServices(next: Services): void {
  services = next;
}

export function appServices(): Services {
  if (!services) {
    throw new Error('Services are not ready.');
  }
  return services;
}
