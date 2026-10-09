import { Router, type Request, type Response } from 'express';
import { getDb, getDatabasePath } from '../db/database.js';
import type { HealthCheckResponse } from '../types/index.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const db = getDb();

    // Verify DB responsiveness
    const dbPing = db.prepare("SELECT datetime('now') as now").get() as { now: string };


    // Fetch counts from tables
    const leadsCount = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number }).count;
    const icpCount = (db.prepare('SELECT COUNT(*) as count FROM icp_profiles').get() as { count: number }).count;
    const docsCount = (db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get() as { count: number }).count;
    const actsCount = (db.prepare('SELECT COUNT(*) as count FROM activities').get() as { count: number }).count;
    const oppsCount = (db.prepare('SELECT COUNT(*) as count FROM opportunities').get() as { count: number }).count;

    const response: HealthCheckResponse = {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'connected',
        type: 'SQLite (better-sqlite3)',
        path: getDatabasePath(),
        tables: {
          leads: leadsCount,
          icp_profiles: icpCount,
          knowledge_documents: docsCount,
          activities: actsCount,
          opportunities: oppsCount,
        },
      },
    };

    res.status(200).json({
      success: true,
      data: response,
      latencyMs: Date.now() - startTime,
      dbServerTime: dbPing.now,
    });
  } catch (error: any) {
    console.error('[Health Check Failure]:', error);

    const failureResponse: HealthCheckResponse = {
      status: 'unhealthy',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        status: 'error',
        type: 'SQLite (better-sqlite3)',
        path: getDatabasePath(),
        tables: null,
        error: error?.message || 'Database connection error',
      },
    };

    res.status(503).json({
      success: false,
      data: failureResponse,
      latencyMs: Date.now() - startTime,
    });
  }
});
