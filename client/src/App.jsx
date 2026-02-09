import { useEffect, useMemo, useState } from "react";
import {
  createAccount,
  createRecord,
  createTag,
  createTarget,
  createTargetTag,
  fetchMetadata,
  fetchRecords,
  fetchStats,
  undoLast,
} from "./api";
import "./styles.css";

const todayIso = () => new Date().toISOString().slice(0, 10);

function monthRange(value) {
  const date = value ? new Date(value) : new Date();
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatMoney(value, currency) {
  if (value === null || value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return value;
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });
  return formatter.format(parsed);
}

function emptyRecord() {
  return {
    date: todayIso(),
    description: "",
    rmb: "",
    usd: "",
    account: "",
    target: "",
    tag1: "",
    tag2: "",
    tag3: "",
    note: "",
    memo: "",
    relatedId: "",
  };
}

export default function App() {
  const [range, setRange] = useState(() => monthRange());
  const [metadata, setMetadata] = useState({
    accounts: [],
    tags: [],
    targets: [],
    targetTags: [],
  });
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [recordForm, setRecordForm] = useState(() => emptyRecord());
  const [accountForm, setAccountForm] = useState({ name: "", currency: "" });
  const [tagForm, setTagForm] = useState({ name: "", note: "" });
  const [targetTagForm, setTargetTagForm] = useState({ name: "", note: "" });
  const [targetForm, setTargetForm] = useState({
    name: "",
    alias: "",
    note: "",
    contact: "",
    tag1: "",
    tag2: "",
  });

  const monthValue = useMemo(() => range.from.slice(0, 7), [range.from]);

  async function refreshAll() {
    setLoading(true);
    try {
      const [metadataData, recordsData, statsData] = await Promise.all([
        fetchMetadata(),
        fetchRecords(range),
        fetchStats(range),
      ]);
      setMetadata(metadataData);
      setRecords(recordsData);
      setStats(statsData);
      setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, [range.from, range.to]);

  async function handleAddRecord(event) {
    event.preventDefault();
    try {
      setLoading(true);
      const payload = {
        ...recordForm,
        account: recordForm.account || null,
        target: recordForm.target || null,
        tag1: recordForm.tag1 || null,
        tag2: recordForm.tag2 || null,
        tag3: recordForm.tag3 || null,
        note: recordForm.note || null,
        memo: recordForm.memo || null,
        relatedId: recordForm.relatedId || null,
      };
      await createRecord(payload);
      setRecordForm(emptyRecord());
      setMessage({ type: "success", text: "Record added." });
      await refreshAll();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    }
  }

  async function handleUndo() {
    try {
      setLoading(true);
      await undoLast();
      setMessage({ type: "success", text: "Last change undone." });
      await refreshAll();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    }
  }

  async function handleSimpleAdd(event, action, reset) {
    event.preventDefault();
    try {
      setLoading(true);
      await action();
      reset();
      setMessage({ type: "success", text: "Saved." });
      await refreshAll();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Money Book</h1>
          <p>Personal finance tracker powered by SQLite.</p>
        </div>
        <div className="header__actions">
          <button type="button" onClick={handleUndo} disabled={loading}>
            Undo Last Change
          </button>
          <button type="button" onClick={refreshAll} disabled={loading}>
            Refresh
          </button>
        </div>
      </header>

      <section className="panel">
        <div className="panel__title">Date Range</div>
        <div className="range__grid">
          <label>
            Month
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setRange(monthRange(`${event.target.value}-01`))}
            />
          </label>
          <label>
            From
            <input
              type="date"
              value={range.from}
              onChange={(event) => setRange({ ...range, from: event.target.value })}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={range.to}
              onChange={(event) => setRange({ ...range, to: event.target.value })}
            />
          </label>
        </div>
      </section>

      {message ? (
        <div className={`message message--${message.type}`}>{message.text}</div>
      ) : null}

      <section className="panel stats">
        <div className="panel__title">Friendly Statistics</div>
        <div className="stats__summary">
          <div className="stat-card">
            <div className="stat-card__label">Entries</div>
            <div className="stat-card__value">{stats?.totals.count ?? 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Total RMB</div>
            <div className="stat-card__value">{formatMoney(stats?.totals.totalRmb ?? 0, "CNY")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Total USD</div>
            <div className="stat-card__value">{formatMoney(stats?.totals.totalUsd ?? 0, "USD")}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__label">Range</div>
            <div className="stat-card__value">
              {stats?.range?.from} → {stats?.range?.to}
            </div>
          </div>
        </div>

        <div className="stats__tables">
          <div className="stats__table">
            <h3>By Tag</h3>
            <table>
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Count</th>
                  <th>RMB</th>
                  <th>USD</th>
                </tr>
              </thead>
              <tbody>
                {stats?.tags?.length ? (
                  stats.tags.map((tag) => (
                    <tr key={tag.tag}>
                      <td>{tag.tag}</td>
                      <td>{tag.count}</td>
                      <td>{formatNumber(tag.totalRmb)}</td>
                      <td>{formatNumber(tag.totalUsd)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">No tagged data in range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="stats__table">
            <h3>Daily Totals</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Count</th>
                  <th>RMB</th>
                  <th>USD</th>
                </tr>
              </thead>
              <tbody>
                {stats?.daily?.length ? (
                  stats.daily.map((day) => (
                    <tr key={day.date}>
                      <td>{day.date}</td>
                      <td>{day.count}</td>
                      <td>{formatNumber(day.totalRmb)}</td>
                      <td>{formatNumber(day.totalUsd)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4">No data in range.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">Add Record</div>
        <form className="form-grid" onSubmit={handleAddRecord}>
          <label>
            Date
            <input
              type="date"
              value={recordForm.date}
              onChange={(event) => setRecordForm({ ...recordForm, date: event.target.value })}
              required
            />
          </label>
          <label>
            Description
            <input
              value={recordForm.description}
              onChange={(event) =>
                setRecordForm({ ...recordForm, description: event.target.value })
              }
              required
            />
          </label>
          <label>
            RMB
            <input
              type="number"
              step="0.01"
              value={recordForm.rmb}
              onChange={(event) => setRecordForm({ ...recordForm, rmb: event.target.value })}
            />
          </label>
          <label>
            USD
            <input
              type="number"
              step="0.01"
              value={recordForm.usd}
              onChange={(event) => setRecordForm({ ...recordForm, usd: event.target.value })}
            />
          </label>
          <label>
            Account
            <select
              value={recordForm.account}
              onChange={(event) => setRecordForm({ ...recordForm, account: event.target.value })}
            >
              <option value="">Select</option>
              {metadata.accounts.map((account) => (
                <option key={account.name} value={account.name}>
                  {account.name} ({account.currency})
                </option>
              ))}
            </select>
          </label>
          <label>
            Target
            <select
              value={recordForm.target}
              onChange={(event) => setRecordForm({ ...recordForm, target: event.target.value })}
            >
              <option value="">Select</option>
              {metadata.targets.map((target) => (
                <option key={target.name} value={target.name}>
                  {target.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag 1
            <select
              value={recordForm.tag1}
              onChange={(event) => setRecordForm({ ...recordForm, tag1: event.target.value })}
            >
              <option value="">Select</option>
              {metadata.tags.map((tag) => (
                <option key={tag.name} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag 2
            <select
              value={recordForm.tag2}
              onChange={(event) => setRecordForm({ ...recordForm, tag2: event.target.value })}
            >
              <option value="">Select</option>
              {metadata.tags.map((tag) => (
                <option key={tag.name} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tag 3
            <select
              value={recordForm.tag3}
              onChange={(event) => setRecordForm({ ...recordForm, tag3: event.target.value })}
            >
              <option value="">Select</option>
              {metadata.tags.map((tag) => (
                <option key={tag.name} value={tag.name}>
                  {tag.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Note
            <input
              value={recordForm.note}
              onChange={(event) => setRecordForm({ ...recordForm, note: event.target.value })}
            />
          </label>
          <label>
            Memo
            <input
              value={recordForm.memo}
              onChange={(event) => setRecordForm({ ...recordForm, memo: event.target.value })}
            />
          </label>
          <label>
            Related ID
            <input
              type="number"
              value={recordForm.relatedId}
              onChange={(event) => setRecordForm({ ...recordForm, relatedId: event.target.value })}
            />
          </label>
          <div className="form-grid__actions">
            <button type="submit" disabled={loading}>
              Add Record
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel__title">Recent Records</div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>RMB</th>
                <th>USD</th>
                <th>Account</th>
                <th>Target</th>
                <th>Tags</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {records.length ? (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.date}</td>
                    <td>{record.description}</td>
                    <td>{formatNumber(record.rmb)}</td>
                    <td>{formatNumber(record.usd)}</td>
                    <td>{record.account}</td>
                    <td>{record.target}</td>
                    <td>{[record.tag1, record.tag2, record.tag3].filter(Boolean).join(", ")}</td>
                    <td>{record.note}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel__title">Manage Lists</div>
        <div className="manage__grid">
          <form
            onSubmit={(event) =>
              handleSimpleAdd(event, () => createAccount(accountForm), () =>
                setAccountForm({ name: "", currency: "" })
              )
            }
          >
            <h3>Add Account</h3>
            <label>
              Name
              <input
                value={accountForm.name}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, name: event.target.value })
                }
                required
              />
            </label>
            <label>
              Currency
              <input
                value={accountForm.currency}
                onChange={(event) =>
                  setAccountForm({ ...accountForm, currency: event.target.value })
                }
              />
            </label>
            <button type="submit" disabled={loading}>
              Save Account
            </button>
          </form>

          <form
            onSubmit={(event) =>
              handleSimpleAdd(event, () => createTag(tagForm), () =>
                setTagForm({ name: "", note: "" })
              )
            }
          >
            <h3>Add Tag</h3>
            <label>
              Name
              <input
                value={tagForm.name}
                onChange={(event) => setTagForm({ ...tagForm, name: event.target.value })}
                required
              />
            </label>
            <label>
              Note
              <input
                value={tagForm.note}
                onChange={(event) => setTagForm({ ...tagForm, note: event.target.value })}
              />
            </label>
            <button type="submit" disabled={loading}>
              Save Tag
            </button>
          </form>

          <form
            onSubmit={(event) =>
              handleSimpleAdd(event, () => createTargetTag(targetTagForm), () =>
                setTargetTagForm({ name: "", note: "" })
              )
            }
          >
            <h3>Add Target Tag</h3>
            <label>
              Name
              <input
                value={targetTagForm.name}
                onChange={(event) =>
                  setTargetTagForm({ ...targetTagForm, name: event.target.value })
                }
                required
              />
            </label>
            <label>
              Note
              <input
                value={targetTagForm.note}
                onChange={(event) =>
                  setTargetTagForm({ ...targetTagForm, note: event.target.value })
                }
              />
            </label>
            <button type="submit" disabled={loading}>
              Save Target Tag
            </button>
          </form>

          <form
            onSubmit={(event) =>
              handleSimpleAdd(event, () => createTarget(targetForm), () =>
                setTargetForm({ name: "", alias: "", note: "", contact: "", tag1: "", tag2: "" })
              )
            }
          >
            <h3>Add Target</h3>
            <label>
              Name
              <input
                value={targetForm.name}
                onChange={(event) => setTargetForm({ ...targetForm, name: event.target.value })}
                required
              />
            </label>
            <label>
              Alias
              <input
                value={targetForm.alias}
                onChange={(event) => setTargetForm({ ...targetForm, alias: event.target.value })}
              />
            </label>
            <label>
              Contact
              <input
                value={targetForm.contact}
                onChange={(event) => setTargetForm({ ...targetForm, contact: event.target.value })}
              />
            </label>
            <label>
              Tag 1
              <select
                value={targetForm.tag1}
                onChange={(event) => setTargetForm({ ...targetForm, tag1: event.target.value })}
              >
                <option value="">Select</option>
                {metadata.targetTags.map((tag) => (
                  <option key={tag.name} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tag 2
              <select
                value={targetForm.tag2}
                onChange={(event) => setTargetForm({ ...targetForm, tag2: event.target.value })}
              >
                <option value="">Select</option>
                {metadata.targetTags.map((tag) => (
                  <option key={tag.name} value={tag.name}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note
              <input
                value={targetForm.note}
                onChange={(event) => setTargetForm({ ...targetForm, note: event.target.value })}
              />
            </label>
            <button type="submit" disabled={loading}>
              Save Target
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
