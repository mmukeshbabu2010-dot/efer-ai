import type { Server } from 'node:http';

export interface ProductionServerOptions {
  fetchImpl?: typeof fetch;
}

export function createProductionServer(
  distDir?: string,
  options?: ProductionServerOptions,
): Server;
