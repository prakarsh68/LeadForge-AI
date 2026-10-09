import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const envPath = process.env.DB_PATH;
  if (envPath) {
    if (path.isAbsolute(envPath)) {
      return envPath;
    }
    // Resolve relative to server root (2 levels up from src/db)
    return path.resolve(__dirname, '../../', envPath);
  }
  return path.resolve(__dirname, '../../data/leadforge.db');
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const dbDir = path.dirname(dbPath);

  // Ensure data directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbInstance = new Database(dbPath);

  // Enforce foreign key constraints
  dbInstance.pragma('foreign_keys = ON');

  // Use WAL mode for better concurrency and reliability
  dbInstance.pragma('journal_mode = WAL');

  return dbInstance;
}

export function setDb(customDb: Database.Database | null): void {
  if (dbInstance && dbInstance !== customDb) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
  }
  dbInstance = customDb;
}

export function closeDb(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore
    }
    dbInstance = null;
  }
}

