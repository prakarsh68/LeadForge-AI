import type { Request, Response, NextFunction } from 'express';

export function isSourceIntelligenceEnabled(): boolean {
  return process.env.SOURCE_INTELLIGENCE_ENABLED === 'true';
}

export function requireSourceIntelligence(req: Request, res: Response, next: NextFunction): void {
  if (!isSourceIntelligenceEnabled()) {
    res.status(403).json({
      error: 'SOURCE_INTELLIGENCE_DISABLED',
      message: 'Adaptive Source Intelligence Engine is disabled. Set SOURCE_INTELLIGENCE_ENABLED=true to activate this feature.',
    });
    return;
  }
  next();
}

