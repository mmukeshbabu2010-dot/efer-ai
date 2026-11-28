import type { Server } from 'node:http';

export function createProductionServer(distDir?: string): Server;
