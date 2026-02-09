export const COLUMN_MAP = {
  id: "ID",
  date: "日期",
  description: "描述",
  rmb: "RMB",
  usd: "USD",
  target: "对方",
  account: "账户",
  note: "备注",
  memo: "备忘",
  tag1: "标签1",
  tag2: "标签2",
  tag3: "标签3",
  relatedId: "关联1",
};

export const PRIMARY_KEYS = {
  accounts: "name",
  tags: "名称",
  targets: "名称",
  target_tags: "名称",
  main: "ID",
};

export function toYyMmDd(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{6}$/.test(trimmed)) return trimmed;
  if (/^\d{8}$/.test(trimmed)) return trimmed.slice(2);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed.slice(2, 4)}${trimmed.slice(5, 7)}${trimmed.slice(8, 10)}`;
  }
  return trimmed;
}

export function toIsoDate(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^\d{6}$/.test(trimmed)) {
    return `20${trimmed.slice(0, 2)}-${trimmed.slice(2, 4)}-${trimmed.slice(4, 6)}`;
  }
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`;
  }
  return trimmed;
}

export function quoteId(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

export function normalizeNumberInput(value) {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed;
}

export function toApiRecord(row) {
  return {
    id: row.ID,
    date: toIsoDate(row.日期),
    description: row.描述,
    rmb: row.RMB,
    usd: row.USD,
    target: row.对方,
    account: row.账户,
    note: row.备注,
    memo: row.备忘,
    tag1: row.标签1,
    tag2: row.标签2,
    tag3: row.标签3,
    relatedId: row.关联1,
  };
}

export function toDbRecord(payload) {
  return {
    日期: toYyMmDd(payload.date),
    描述: payload.description ?? null,
    RMB: normalizeNumberInput(payload.rmb),
    USD: normalizeNumberInput(payload.usd),
    对方: payload.target ?? null,
    账户: payload.account ?? null,
    备注: payload.note ?? null,
    备忘: payload.memo ?? null,
    标签1: payload.tag1 ?? null,
    标签2: payload.tag2 ?? null,
    标签3: payload.tag3 ?? null,
    关联1: payload.relatedId ?? null,
  };
}

export function asNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const cleaned = String(value).replace(/,/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function getDefaultRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: start.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}
