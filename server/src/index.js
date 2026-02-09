import cors from "cors";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { getDb } from "./db.js";
import { applyUndo, hasUndo, recordUndo } from "./undo.js";
import {
  asNumber,
  getDefaultRange,
  quoteId,
  toApiRecord,
  toDbRecord,
  toIsoDate,
  toYyMmDd,
} from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "..", "..", "client", "dist");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

function resolveRange(query) {
  const fallback = getDefaultRange();
  const from = toYyMmDd(query.from || fallback.from);
  const to = toYyMmDd(query.to || fallback.to);
  return {
    from,
    to,
    fromIso: toIsoDate(from),
    toIso: toIsoDate(to),
  };
}

function requireText(value, label) {
  if (!value || !String(value).trim()) {
    const error = new Error(`${label} is required`);
    error.status = 400;
    throw error;
  }
}

function buildInsert(table, data) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  const columns = entries.map(([column]) => column);
  const values = entries.map(([, value]) => value ?? null);
  const placeholders = columns.map(() => "?").join(", ");
  return {
    sql: `INSERT INTO ${quoteId(table)} (${columns.map(quoteId).join(", ")}) VALUES (${placeholders})`,
    params: values,
  };
}

async function insertSimple(db, table, data, pkField) {
  const { sql, params } = buildInsert(table, data);
  await db.run(sql, params);
  if (pkField && data[pkField]) {
    recordUndo({
      label: `Insert into ${table}`,
      steps: [
        {
          sql: `DELETE FROM ${quoteId(table)} WHERE ${quoteId(pkField)} = ?`,
          params: [data[pkField]],
        },
      ],
    });
  }
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/api/metadata", async (req, res, next) => {
  try {
    const db = await getDb();
    const [accounts, tags, targets, targetTags] = await Promise.all([
      db.all("SELECT name, currency FROM accounts ORDER BY name"),
      db.all('SELECT 名称 as name, 说明 as note FROM tags ORDER BY 名称'),
      db.all(
        'SELECT 名称 as name, 别名 as alias, 备注 as note, 联系方式 as contact, tag1, tag2 FROM targets ORDER BY 名称'
      ),
      db.all('SELECT 名称 as name, 说明 as note FROM target_tags ORDER BY 名称'),
    ]);
    res.json({ accounts, tags, targets, targetTags });
  } catch (error) {
    next(error);
  }
});

app.get("/api/records", async (req, res, next) => {
  try {
    const db = await getDb();
    const where = [];
    const params = [];
    if (req.query.from) {
      where.push("日期 >= ?");
      params.push(toYyMmDd(req.query.from));
    }
    if (req.query.to) {
      where.push("日期 <= ?");
      params.push(toYyMmDd(req.query.to));
    }
    const limit = Math.min(Number.parseInt(req.query.limit || "200", 10), 500);
    const offset = Number.parseInt(req.query.offset || "0", 10);
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const rows = await db.all(
      `SELECT * FROM main ${clause} ORDER BY 日期 DESC, ID DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    res.json(rows.map(toApiRecord));
  } catch (error) {
    next(error);
  }
});

app.post("/api/records", async (req, res, next) => {
  try {
    const db = await getDb();
    const dbRecord = toDbRecord(req.body || {});
    requireText(dbRecord.日期, "date");

    const entries = Object.entries(dbRecord).filter(([, value]) => value !== undefined);
    const columns = entries.map(([column]) => column);
    const values = entries.map(([, value]) => value ?? null);
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO main (${columns.map(quoteId).join(", ")}) VALUES (${placeholders})`;

    const result = await db.run(sql, values);
    const row = await db.get("SELECT * FROM main WHERE ID = ?", result.lastID);
    recordUndo({
      label: `Insert record #${result.lastID}`,
      steps: [
        {
          sql: "DELETE FROM main WHERE ID = ?",
          params: [result.lastID],
        },
      ],
    });
    res.status(201).json(toApiRecord(row));
  } catch (error) {
    next(error);
  }
});

app.post("/api/undo", async (req, res, next) => {
  try {
    if (!hasUndo()) {
      return res.status(409).json({ error: "No changes to undo." });
    }
    const db = await getDb();
    const entry = await applyUndo(db);
    res.json({ ok: true, label: entry?.label ?? "Undo" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stats", async (req, res, next) => {
  try {
    const db = await getDb();
    const range = resolveRange(req.query);
    const [totals, tags, daily] = await Promise.all([
      db.get(
        `SELECT COUNT(*) as count,
        SUM(CAST(REPLACE(RMB, ',', '') AS REAL)) as totalRmb,
        SUM(CAST(REPLACE(USD, ',', '') AS REAL)) as totalUsd
        FROM main WHERE 日期 BETWEEN ? AND ?`,
        [range.from, range.to]
      ),
      db.all(
        `SELECT 标签1 as tag,
        COUNT(*) as count,
        SUM(CAST(REPLACE(RMB, ',', '') AS REAL)) as totalRmb,
        SUM(CAST(REPLACE(USD, ',', '') AS REAL)) as totalUsd
        FROM main
        WHERE 日期 BETWEEN ? AND ? AND 标签1 IS NOT NULL
        GROUP BY 标签1
        ORDER BY count DESC`,
        [range.from, range.to]
      ),
      db.all(
        `SELECT 日期 as date,
        COUNT(*) as count,
        SUM(CAST(REPLACE(RMB, ',', '') AS REAL)) as totalRmb,
        SUM(CAST(REPLACE(USD, ',', '') AS REAL)) as totalUsd
        FROM main
        WHERE 日期 BETWEEN ? AND ?
        GROUP BY 日期
        ORDER BY 日期`,
        [range.from, range.to]
      ),
    ]);

    res.json({
      range: { from: range.fromIso, to: range.toIso },
      totals: {
        count: totals?.count ?? 0,
        totalRmb: asNumber(totals?.totalRmb),
        totalUsd: asNumber(totals?.totalUsd),
      },
      tags: tags.map((tag) => ({
        tag: tag.tag,
        count: tag.count,
        totalRmb: asNumber(tag.totalRmb),
        totalUsd: asNumber(tag.totalUsd),
      })),
      daily: daily.map((row) => ({
        date: toIsoDate(row.date),
        count: row.count,
        totalRmb: asNumber(row.totalRmb),
        totalUsd: asNumber(row.totalUsd),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/accounts", async (req, res, next) => {
  try {
    const { name, currency } = req.body || {};
    requireText(name, "name");
    const db = await getDb();
    await insertSimple(db, "accounts", { name, currency: currency ?? null }, "name");
    res.status(201).json({ name, currency: currency ?? null });
  } catch (error) {
    next(error);
  }
});

app.post("/api/tags", async (req, res, next) => {
  try {
    const { name, note } = req.body || {};
    requireText(name, "name");
    const db = await getDb();
    await insertSimple(db, "tags", { 名称: name, 说明: note ?? null }, "名称");
    res.status(201).json({ name, note: note ?? null });
  } catch (error) {
    next(error);
  }
});

app.post("/api/target-tags", async (req, res, next) => {
  try {
    const { name, note } = req.body || {};
    requireText(name, "name");
    const db = await getDb();
    await insertSimple(db, "target_tags", { 名称: name, 说明: note ?? null }, "名称");
    res.status(201).json({ name, note: note ?? null });
  } catch (error) {
    next(error);
  }
});

app.post("/api/targets", async (req, res, next) => {
  try {
    const { name, alias, note, contact, tag1, tag2 } = req.body || {};
    requireText(name, "name");
    const db = await getDb();
    await insertSimple(
      db,
      "targets",
      {
        名称: name,
        别名: alias ?? null,
        备注: note ?? null,
        联系方式: contact ?? null,
        tag1: tag1 ?? null,
        tag2: tag2 ?? null,
      },
      "名称"
    );
    res.status(201).json({ name, alias, note, contact, tag1, tag2 });
  } catch (error) {
    next(error);
  }
});

if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error, req, res, next) => {
  const status = error.status || 500;
  res.status(status).json({ error: error.message || "Server error" });
});

app.listen(PORT, () => {
  console.log(`Money Book server running on http://localhost:${PORT}`);
});
