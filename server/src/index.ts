import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load environment variables before any other imports that rely on process.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createApp } from './app.js';
import { initializeDatabase } from './db/init.js';
import { closeDb, getDatabasePath } from './db/database.js';

const PORT = parseInt(process.env.PORT || '5000', 10);

async function startServer(): Promise<void> {
  try {
    console.log('[LeadForge Server] Booting up...');

    // Initialize database tables and indexes safely
    initializeDatabase();
    console.log(`[LeadForge Server] SQLite database initialized at: ${getDatabasePath()}`);

    const app = createApp();

    const server = app.listen(PORT, () => {
      console.log(`[LeadForge Server] HTTP service running on: http://localhost:${PORT}`);
      console.log(`[LeadForge Server] Health check available at: http://localhost:${PORT}/api/health`);
    });

    // Graceful Shutdown Handlers
    const handleShutdown = (signal: string) => {
      console.log(`\n[LeadForge Server] Received ${signal}. Shutting down gracefully...`);
      server.close(() => {
        closeDb();
        console.log('[LeadForge Server] Database connection closed. Server terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  } catch (error) {
    console.error('[LeadForge Server] Fatal startup failure:', error);
    process.exit(1);
  }
}

startServer();
