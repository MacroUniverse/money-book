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

const FIAT_RATE_URL = "https://open.er-api.com/v6/latest/USD";
const COINBASE_SPOT_URL = "https://api.coinbase.com/v2/prices";
const RATE_TIMEOUT_MS = 8000;

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

function parseAmount(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  const match = text.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeCurrencyCode(value) {
  if (!value) return null;
  const cleaned = String(value).trim().toLowerCase();
  if (!cleaned) return null;
  if (["rmb", "cny", "renminbi"].includes(cleaned)) return "CNY";
  if (["usd", "usdt"].includes(cleaned)) return "USD";
  if (cleaned === "btc") return "BTC";
  if (cleaned === "eth") return "ETH";
  return cleaned.toUpperCase();
}

function parseCurrencyInfo(value) {
  if (!value) {
    return { code: null, multiplier: 1 };
  }
  const raw = String(value).trim();
  if (!raw) {
    return { code: null, multiplier: 1 };
  }
  const lower = raw.toLowerCase();
  const multiplier = /1e4|10\^4|万/.test(lower) ? 10000 : 1;
  const cleaned = lower.replace(/\(.*?\)/g, " ").replace(/1e4|10\^4|万/g, " ");
  const code = cleaned.trim().split(/\s+/)[0];
  return { code: normalizeCurrencyCode(code), multiplier };
}

async function fetchJson(url, timeoutMs = RATE_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Request failed (${response.status})`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFiatRates() {
  const data = await fetchJson(FIAT_RATE_URL);
  if (data?.result && data.result !== "success") {
    throw new Error(data?.error || "Failed to fetch fiat rates");
  }
  if (!data?.rates || typeof data.rates !== "object") {
    throw new Error("Unexpected fiat rate response");
  }
  return data.rates;
}

async function fetchCoinbaseSpot(pair) {
  const data = await fetchJson(`${COINBASE_SPOT_URL}/${pair}/spot`);
  const amount = parseAmount(data?.data?.amount);
  if (!Number.isFinite(amount)) {
    throw new Error(`Unexpected coinbase response for ${pair}`);
  }
  return amount;
}

async function ensureAssetRatesTable(db) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS asset_rates (
      currency TEXT PRIMARY KEY,
      rate_to_rmb REAL,
      updated_at TEXT
    )`
  );
}

async function loadStoredRates(db) {
  await ensureAssetRatesTable(db);
  const rows = await db.all("SELECT currency, rate_to_rmb, updated_at FROM asset_rates");
  const rates = {};
  let updatedAt = null;
  rows.forEach((row) => {
    if (row?.currency && Number.isFinite(row.rate_to_rmb)) {
      rates[row.currency] = row.rate_to_rmb;
      if (!updatedAt || (row.updated_at && row.updated_at > updatedAt)) {
        updatedAt = row.updated_at;
      }
    }
  });
  return { rates, updatedAt };
}

async function saveRates(db, rates) {
  const now = new Date().toISOString();
  const entries = Object.entries(rates).filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return now;
  const stmt = await db.prepare(
    `INSERT INTO asset_rates (currency, rate_to_rmb, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(currency) DO UPDATE SET
       rate_to_rmb = excluded.rate_to_rmb,
       updated_at = excluded.updated_at`
  );
  try {
    for (const [currency, rate] of entries) {
      await stmt.run(currency, rate, now);
    }
  } finally {
    await stmt.finalize();
  }
  return now;
}

async function buildRateMap(codes, { refresh, db }) {
  const requestedCodes = new Set(codes.filter(Boolean));
  requestedCodes.add("CNY");
  const stored = await loadStoredRates(db);
  const rateMap = { ...stored.rates, CNY: 1 };
  let updatedAt = stored.updatedAt;
  let stale = false;
  const liveRates = {};

  let usdToCny = rateMap.USD ?? null;

  if (refresh) {
    try {
      const fiatRates = await fetchFiatRates();
      const liveUsdToCny = parseAmount(fiatRates?.CNY);
      if (Number.isFinite(liveUsdToCny)) {
        usdToCny = liveUsdToCny;
        liveRates.USD = liveUsdToCny;
        rateMap.USD = liveUsdToCny;
      }

      for (const code of requestedCodes) {
        if (code === "CNY") {
          rateMap.CNY = 1;
          liveRates.CNY = 1;
          continue;
        }
        if (code === "USD") continue;
        const fiatRate = parseAmount(fiatRates?.[code]);
        if (Number.isFinite(fiatRate) && Number.isFinite(usdToCny)) {
          const rateToRmb = usdToCny / fiatRate;
          rateMap[code] = rateToRmb;
          liveRates[code] = rateToRmb;
        }
      }
    } catch (error) {
      stale = true;
    }

    if (requestedCodes.has("BTC") || requestedCodes.has("ETH")) {
      try {
        const [btcUsd, ethUsd] = await Promise.all([
          requestedCodes.has("BTC") ? fetchCoinbaseSpot("BTC-USD") : null,
          requestedCodes.has("ETH") ? fetchCoinbaseSpot("ETH-USD") : null,
        ]);
        if (Number.isFinite(usdToCny)) {
          if (Number.isFinite(btcUsd)) {
            const rate = btcUsd * usdToCny;
            rateMap.BTC = rate;
            liveRates.BTC = rate;
          }
          if (Number.isFinite(ethUsd)) {
            const rate = ethUsd * usdToCny;
            rateMap.ETH = rate;
            liveRates.ETH = rate;
          }
        }
      } catch (error) {
        stale = true;
      }
    }

    if (Object.keys(liveRates).length) {
      updatedAt = await saveRates(db, liveRates);
    }
  }

  return { rateMap, stale, updatedAt };
}

async function refreshAssets(db, { refresh }) {
  const rows = await db.all(
    "SELECT rowid as id, account, time, currency, amount, to_rmb, tag FROM assets"
  );
  const codes = [];
  rows.forEach((row) => {
    const { code } = parseCurrencyInfo(row.currency);
    if (code) codes.push(code);
  });

  const { rateMap, stale, updatedAt } = await buildRateMap(codes, { refresh, db });
  const assets = [];
  const updates = [];
  const totalsByTag = new Map();
  let totalRmb = 0;

  rows.forEach((row) => {
    const amount = parseAmount(row.amount);
    const { code, multiplier } = parseCurrencyInfo(row.currency);
    const normalizedAmount = Number.isFinite(amount) ? amount * multiplier : null;
    const existingToRmb = parseAmount(row.to_rmb);
    let rateToRmb = code ? rateMap[code] : null;
    if (!Number.isFinite(rateToRmb) && Number.isFinite(existingToRmb) && normalizedAmount) {
      rateToRmb = existingToRmb / normalizedAmount;
    }

    let computedToRmb = existingToRmb;
    if (Number.isFinite(rateToRmb) && Number.isFinite(normalizedAmount)) {
      computedToRmb = normalizedAmount * rateToRmb;
    }

    if (Number.isFinite(computedToRmb)) {
      totalRmb += computedToRmb;
      const tag = row.tag || "Uncategorized";
      totalsByTag.set(tag, (totalsByTag.get(tag) || 0) + computedToRmb);
    }

    if (
      Number.isFinite(computedToRmb) &&
      (!Number.isFinite(existingToRmb) || Math.abs(computedToRmb - existingToRmb) > 0.005)
    ) {
      updates.push({ id: row.id, value: computedToRmb });
    }

    assets.push({
      id: row.id,
      account: row.account,
      time: toIsoDate(row.time),
      currency: row.currency,
      amount: row.amount,
      amountNormalized: normalizedAmount,
      rateToRmb: Number.isFinite(rateToRmb) ? rateToRmb : null,
      toRmb: Number.isFinite(computedToRmb) ? computedToRmb : null,
      tag: row.tag,
      multiplier,
    });
  });

  if (updates.length) {
    await db.exec("BEGIN");
    try {
      for (const update of updates) {
        await db.run("UPDATE assets SET to_rmb = ? WHERE rowid = ?", [
          update.value,
          update.id,
        ]);
      }
      await db.exec("COMMIT");
    } catch (error) {
      await db.exec("ROLLBACK");
      throw error;
    }
  }

  const byTag = Array.from(totalsByTag.entries())
    .map(([tag, value]) => ({ tag, totalRmb: value }))
    .sort((a, b) => b.totalRmb - a.totalRmb);

  return {
    assets,
    totals: {
      totalRmb,
      count: assets.length,
    },
    byTag,
    rates: rateMap,
    stale,
    updatedAt,
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

app.get("/api/assets", async (req, res, next) => {
  try {
    const db = await getDb();
    const refresh = !["0", "false"].includes(String(req.query.refresh || "").toLowerCase());
    const data = await refreshAssets(db, { refresh });
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.post("/api/assets", async (req, res, next) => {
  try {
    const { account, time, currency, amount, tag } = req.body || {};
    requireText(account, "account");
    requireText(currency, "currency");
    if (amount === undefined || amount === null || String(amount).trim() === "") {
      const error = new Error("amount is required");
      error.status = 400;
      throw error;
    }
    const db = await getDb();
    const resolvedTime = toYyMmDd(time || new Date().toISOString().slice(0, 10));
    const payload = {
      account,
      time: resolvedTime,
      currency,
      amount: String(amount).trim(),
      to_rmb: null,
      tag: tag ?? null,
    };
    const { sql, params } = buildInsert("assets", payload);
    const result = await db.run(sql, params);

    const { code, multiplier } = parseCurrencyInfo(currency);
    const amountValue = parseAmount(amount);
    if (code && Number.isFinite(amountValue)) {
      const { rateMap } = await buildRateMap([code], { refresh: true, db });
      const rateToRmb = rateMap[code];
      if (Number.isFinite(rateToRmb)) {
        const computedToRmb = amountValue * multiplier * rateToRmb;
        if (Number.isFinite(computedToRmb)) {
          await db.run("UPDATE assets SET to_rmb = ? WHERE rowid = ?", [
            computedToRmb,
            result.lastID,
          ]);
        }
      }
    }

    const row = await db.get(
      "SELECT rowid as id, account, time, currency, amount, to_rmb, tag FROM assets WHERE rowid = ?",
      result.lastID
    );
    recordUndo({
      label: `Insert asset #${result.lastID}`,
      steps: [
        {
          sql: "DELETE FROM assets WHERE rowid = ?",
          params: [result.lastID],
        },
      ],
    });
    res.status(201).json(row);
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
