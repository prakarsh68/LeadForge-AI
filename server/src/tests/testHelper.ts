import Database from 'better-sqlite3';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../app.js';
import { setDb, closeDb } from '../db/database.js';
import { initializeDatabase } from '../db/init.js';

export interface TestContext {
  db: Database.Database;
  baseUrl: string;
  request: (path: string, init?: RequestInit) => Promise<{ status: number; body: any }>;
  cleanup: () => Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  // Use in-memory SQLite database
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  initializeDatabase(db);
  setDb(db);

  const app = createApp();

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const request = async (path: string, init: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    };

    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
    });

    let body: any = null;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return {
      status: res.status,
      body,
    };
  };

  const cleanup = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    try {
      db.close();
    } catch {
      // ignore
    }
    closeDb();
  };

  return {
    db,
    baseUrl,
    request,
    cleanup,
  };
}
