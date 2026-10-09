import type { Request, Response, NextFunction } from 'express';

export function isAgenticSourcingEnabled(): boolean {
  return process.env.AGENTIC_SOURCING_ENABLED === 'true';
}

export function requireAgenticSourcing(req: Request, res: Response, next: NextFunction): void {
  if (!isAgenticSourcingEnabled()) {
    res.status(403).json({
      error: 'AGENTIC_SOURCING_DISABLED',
      message: 'Agentic Sourcing Orchestrator is disabled. Set AGENTIC_SOURCING_ENABLED=true to activate this feature.',
    });
    return;
  }
  next();
}

