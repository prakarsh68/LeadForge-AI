import express, { type Application } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
import { leadsRouter } from './routes/leads.js';
import { icpRouter } from './routes/icp.js';
import { opportunitiesRouter } from './routes/opportunities.js';
import { activitiesRouter } from './routes/activities.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { discoveryRouter } from './routes/discovery.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp(): Application {
  const app = express();

  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

  // Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: [clientOrigin, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Body Parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Root welcome route
  app.get('/', (_req, res) => {
    res.json({
      message: 'LeadForge AI Autonomous Outbound API is operational.',
      docs: '/api/health',
      version: '1.0.0',
    });
  });

  // API Routes
  app.use('/api', healthRouter);
  app.use('/api', leadsRouter);
  app.use('/api', icpRouter);
  app.use('/api', opportunitiesRouter);
  app.use('/api', activitiesRouter);
  app.use('/api', knowledgeRouter);
  app.use('/api', discoveryRouter);

  // Catch-all 404 Handler
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

