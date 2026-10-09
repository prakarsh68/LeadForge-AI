import express, { type Application } from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health.js';
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

  // Catch-all 404 Handler
  app.use(notFoundHandler);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
