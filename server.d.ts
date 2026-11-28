import type { Server } from 'node:http';

export interface ProductionServerOptions {
  fetchImpl?: typeof fetch;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

export function createProductionServer(
  distDir?: string,
  options?: ProductionServerOptions,
): Server;
