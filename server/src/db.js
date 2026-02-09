import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, "..", "data");
const dbPath = path.join(dataDir, "ledger.db");
const dumpPath = path.resolve(__dirname, "..", "..", "ledger.db.sql");

let dbPromise;

async function initializeDatabase() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const isNew = !fs.existsSync(dbPath);
  const db = await open({ filename: dbPath, driver: sqlite3.Database });

  if (isNew) {
    if (!fs.existsSync(dumpPath)) {
      throw new Error(`Missing SQL dump at ${dumpPath}`);
    }
    const dump = fs.readFileSync(dumpPath, "utf8");
    await db.exec(dump);
  }

  await db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = initializeDatabase();
  }
  return dbPromise;
}

export { dbPath };
