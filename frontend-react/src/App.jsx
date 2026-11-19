import { useEffect, useMemo, useState } from "react";
import AdvancedAnalysis from "./AdvancedAnalysis";
import "./App.css";

const API = "http://127.0.0.1:8000";
const TOKEN = "pcp_react_token";
const EMAIL = "pcp_react_email";

async function request(path, options = {}, token = "") {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(
      typeof data === "object"
        ? data.detail || data.message || "Request failed"
        : data || "Request failed"
    );
  }

  return data;
}

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem(TOKEN) || ""
  );
  const [email, setEmail] = useState(
    () => localStorage.getItem(EMAIL) || ""
  );

  const [mode, setMode] = useState("login");
  const [page, setPage] = useState("overview");
  const [showPassword, setShowPassword] = useState(false);

  const [signal, setSignal] = useState(null);
  const [model, setModel] = useState(null);
  const [history, setHistory] = useState([]);
  const [days, setDays] = useState("30");
  const [refreshCount, setRefreshCount] = useState(0);

  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState("checking");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Load real data from the existing FastAPI backend.
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        await request("/api/health");

        if (cancelled) return;
        setApiStatus("connected");

        const results = await Promise.allSettled([
          request("/api/signal", {}, token),
          request("/api/model-info", {}, token),
          request(`/api/deviation?days=${days}`, {}, token),
        ]);

        if (cancelled) return;

        if (results[0].status === "fulfilled") {
          setSignal(results[0].value);
        }

        if (results[1].status === "fulfilled") {
          setModel(results[1].value);
        }

        if (results[2].status === "fulfilled") {
          const result = results[2].value;
          setHistory(Array.isArray(result?.data) ? result.data : []);
        }

        if (results.every((item) => item.status === "rejected")) {
          throw results[0].reason;
        }

        if (results.some((item) => item.status === "rejected")) {
          setError(
            "Some information could not be loaded. Check your backend and try refreshing."
          );
        }
      } catch (err) {
        if (!cancelled) {
          setApiStatus("offline");
          setError(err.message || "Unable to connect to the backend.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();

    return () => {
      cancelled = true;
    };
  }, [token, days, refreshCount]);

  async function handleAuth(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const values = new FormData(form);
    const userEmail = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");

    if (!userEmail || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/login" : "/api/register";

      const result = await request(endpoint, {
        method: "POST",
        body: JSON.stringify({
          email: userEmail,
          password,
        }),
      });

      if (mode === "register") {
        setNotice("Account created. Please sign in.");
        setMode("login");
        form.reset();
        return;
      }

      const receivedToken = result.token || result.access_token;

      if (!receivedToken) {
        throw new Error("The backend did not return a login token.");
      }

      localStorage.setItem(TOKEN, receivedToken);
      localStorage.setItem(EMAIL, userEmail);

      setToken(receivedToken);
      setEmail(userEmail);
      setPage("overview");
    } catch (err) {
      setError(err.message || "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN);
    localStorage.removeItem(EMAIL);

    setToken("");
    setEmail("");
    setSignal(null);
    setModel(null);
    setHistory([]);
    setPage("overview");
    setError("");
    setNotice("");
    setApiStatus("checking");
  }

  if (!token) {
    return (
      <main className="auth-page">
        <section className="auth-visual">
          <div className="auth-brand">
            <span className="brand-mark">P</span>
            <span>
              PCP<span className="accent">AI</span>
            </span>
          </div>

          <div className="auth-hero">
            <p className="eyebrow">OPTIONS MARKET INTELLIGENCE</p>

            <h1>
              Understand the market.
              <br />
              <span className="accent">Explore the data.</span>
            </h1>

            <p>
              Learn how put-call parity works, explore historical
              data, and understand AI model outputs in plain English.
              No prior market knowledge required.
            </p>
          </div>

          <div className="auth-feature">
            <div>
              <span>01</span>
              <strong>Learn the basics</strong>
              <p>Understand options and put-call parity.</p>
            </div>

            <div>
              <span>02</span>
              <strong>Explore insights</strong>
              <p>Discover what your model's results mean.</p>
            </div>
          </div>

          <p className="muted">
            Research workspace · Not investment advice
          </p>
        </section>

        <section className="auth-form-side">
          <form className="auth-card" onSubmit={handleAuth}>
            <p className="eyebrow">
              {mode === "login" ? "WELCOME BACK" : "GET STARTED"}
            </p>

            <h2>
              {mode === "login"
                ? "Sign in to PCP AI"
                : "Create your account"}
            </h2>

            <p className="muted">
              {mode === "login"
                ? "Enter your details to continue."
                : "Create an account to access your workspace."}
            </p>

            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}

            {notice && (
              <div className="message success" role="status">
                {notice}
              </div>
            )}

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
            />

            <label htmlFor="password">Password</label>

            <div className="password-wrap">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                required
              />

              <button
                type="button"
                className="show-password"
                onClick={() =>
                  setShowPassword((visible) => !visible)
                }
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>

            <button
              type="submit"
              className="primary-button full-width"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in →"
                  : "Create account →"}
            </button>

            <p className="auth-switch">
              {mode === "login"
                ? "New to PCP AI?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setMode((current) =>
                    current === "login" ? "register" : "login"
                  );
                  setError("");
                  setNotice("");
                }}
              >
                {mode === "login"
                  ? "Create an account"
                  : "Sign in"}
              </button>
            </p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>

          <div>
            <h2>
              PCP<span className="accent">AI</span>
            </h2>
            <small>OPTIONS INTELLIGENCE</small>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>

        <button
          type="button"
          className={`nav-item ${
            page === "overview" ? "active" : ""
          }`}
          onClick={() => {
            setPage("overview");
            setError("");
          }}
        >
          ◫ &nbsp; Market Overview
        </button>

        <button
          type="button"
          className={`nav-item ${
            page === "analysis" ? "active" : ""
          }`}
          onClick={() => {
            setPage("analysis");
            setError("");
          }}
        >
          ⌁ &nbsp; Advanced Analysis
        </button>

        <div className="sidebar-bottom">
          <div className="connection">
            <span className={`status-dot ${apiStatus}`} />

            <div>
              <strong>Backend status</strong>
              <p>
                {apiStatus === "connected"
                  ? "Connected"
                  : apiStatus === "offline"
                    ? "Connection error"
                    : "Checking..."}
              </p>
            </div>
          </div>

          <p className="muted user-email">{email}</p>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <p className="eyebrow">OPTIONS MARKET INTELLIGENCE</p>

            <h1>
              {page === "overview"
                ? "Market Overview"
                : "Advanced Analysis"}
            </h1>
          </div>

          <div className="top-actions">
            <span className="api-label">
              <span className={`status-dot ${apiStatus}`} />

              {apiStatus === "connected"
                ? "API connected"
                : apiStatus === "offline"
                  ? "API unavailable"
                  : "Checking API"}
            </span>

            <button
              type="button"
              className="secondary-button"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </header>

        {error && (
          <div className="message error page-message" role="alert">
            {error}
          </div>
        )}

        {page === "overview" ? (
          <Overview
            signal={signal}
            model={model}
            history={history}
            days={days}
            setDays={setDays}
            loading={loading}
            refresh={() =>
              setRefreshCount((count) => count + 1)
            }
            openAnalysis={() => {
              setPage("analysis");
              setError("");
            }}
          />
        ) : (
          <section className="content">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">GO DEEPER</p>
                <h2>Advanced Analysis</h2>
                <p>
                  Submit market inputs to your existing AI model
                  and explore the feature explanations returned
                  by the backend.
                </p>
              </div>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPage("overview");
                  setError("");
                }}
              >
                ← Market overview
              </button>
            </div>

            <AdvancedAnalysis signal={signal} model={model} />
          </section>
        )}

        <footer className="footer">
          <span>PCP AI · Options analysis workspace</span>
          <span>Historical model output · Not live market data</span>
        </footer>
      </main>
    </div>
  );
}

function Overview({
  signal,
  model,
  history,
  days,
  setDays,
  loading,
  refresh,
  openAnalysis,
}) {
  const [showChart, setShowChart] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  const values = useMemo(
    () =>
      history
        .map((item) => Number(item.deviation))
        .filter(Number.isFinite),
    [history]
  );

  const high = values.length ? Math.max(...values) : null;
  const low = values.length ? Math.min(...values) : null;

  const latest =
    signal?.deviation ?? history.at(-1)?.deviation;

  const signalName =
    signal?.signal || history.at(-1)?.signal || null;

  const latestDate =
    signal?.date || history.at(-1)?.date || null;

  const counts = history.reduce(
    (acc, item) => {
      const name = String(item.signal || "").toUpperCase();

      if (name in acc) acc[name]++;

      return acc;
    },
    { BUY: 0, SELL: 0, HOLD: 0 }
  );

  return (
    <section className="content">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">YOUR LEARNING WORKSPACE</p>
          <h2>Welcome to PCP AI</h2>

          <p>
            New to financial markets? Start here. Learn the
            concepts first, then explore the numbers when you're
            ready.
          </p>

          <p className="data-note">
            Historical analysis · Not a live market feed
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={refresh}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh data"}
        </button>
      </div>

      <div className="panel">
        <p className="eyebrow">START WITH THE BASICS</p>
        <h3>What is Put-Call Parity?</h3>

        <p>
          Put-call parity is a rule that connects the prices of
          certain call options, put options, the underlying asset,
          and cash. Under specific assumptions, two different
          combinations should have equivalent values.
        </p>

        <div className="guide-item">
          <b>01</b>
          <div>
            <strong>What is a call option?</strong>
            <p>
              It gives its buyer the right, but not the obligation,
              to buy an asset at an agreed price under the
              contract's terms.
            </p>
          </div>
        </div>

        <div className="guide-item">
          <b>02</b>
          <div>
            <strong>What is a put option?</strong>
            <p>
              It gives its buyer the right, but not the obligation,
              to sell an asset at an agreed price under the
              contract's terms.
            </p>
          </div>
        </div>

        <div className="guide-item">
          <b>03</b>
          <div>
            <strong>Why compare their prices?</strong>
            <p>
              The relationship helps analysts check whether option
              prices are consistent with a theoretical pricing rule.
            </p>
          </div>
        </div>
      </div>

      <div className="panel">
        <p className="eyebrow">YOUR DATA REPORT</p>
        <h3>What does your data tell us?</h3>

        {loading && history.length === 0 ? (
          <div className="empty-state">
            Loading your report...
          </div>
        ) : (
          <>
            <div className="detail-list">
              <Detail
                label="Latest available deviation"
                value={
                  latest === null || latest === undefined
                    ? "Not available"
                    : formatNumber(latest)
                }
              />

              <Detail
                label="Observation date"
                value={latestDate || "Not provided by API"}
              />

              <Detail
                label="Model output"
                value={signalName || "Not available"}
              />

              <Detail
                label="Historical records loaded"
                value={history.length}
              />
            </div>

            <div className="guide-item">
              <b>i</b>
              <div>
                <strong>What does the result mean?</strong>

                <p>
                  {signalName
                    ? `Your model returned "${signalName}". This is the model's output, not a guarantee of what the market will do.`
                    : "No model signal is available right now. Try refreshing the data."}
                </p>

                <p>
                  Deviation measures a difference from a specified
                  parity relationship. Its interpretation depends
                  on the calculation used by this project. A
                  non-zero value alone does not prove that a
                  profitable trading opportunity exists.
                </p>
              </div>
            </div>

            {signal?.rationale && (
              <div className="guide-item">
                <b>AI</b>
                <div>
                  <strong>Model explanation</strong>
                  <p>{signal.rationale}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="two-column">
        <div className="panel">
          <h3>Explore historical data</h3>

          <p>
            Select the number of days of historical records to
            request from your backend.
          </p>

          <label className="range-control">
            Historical range

            <select
              value={days}
              onChange={(event) => setDays(event.target.value)}
            >
              <option value="10">10 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="120">120 days</option>
            </select>
          </label>

          <p className="muted">
            This changes the historical data requested. It does
            not predict future market movements.
          </p>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowChart((visible) => !visible)}
          >
            {showChart
              ? "Hide historical graph"
              : "Show historical graph"}
          </button>

          {showChart && (
            <div style={{ marginTop: "20px" }}>
              {history.length > 0 ? (
                <Chart history={history} />
              ) : (
                <p>
                  No historical records are available to display.
                </p>
              )}
            </div>
          )}
        </div>

        <div className="panel">
          <h3>Understand the numbers</h3>

          <div className="guide-item">
            <b>1</b>
            <div>
              <strong>Positive and negative values</strong>
              <p>
                These show whether a value is above or below zero.
                Their financial meaning depends on your project's
                deviation formula.
              </p>
            </div>
          </div>

          <div className="guide-item">
            <b>2</b>
            <div>
              <strong>Highest and lowest</strong>
              <p>
                These are the largest and smallest numeric
                deviations among the records currently loaded.
              </p>
            </div>
          </div>

          <Detail
            label="Highest recorded deviation"
            value={formatNumber(high)}
          />

          <Detail
            label="Lowest recorded deviation"
            value={formatNumber(low)}
          />
        </div>
      </div>

      <div className="panel">
        <h3>Historical signal summary</h3>

        <p>
          These counts describe the labels in the returned
          historical records. They do not indicate future results.
        </p>

        <div className="detail-list">
          <Detail label="BUY records" value={counts.BUY} />
          <Detail label="SELL records" value={counts.SELL} />
          <Detail label="HOLD records" value={counts.HOLD} />
        </div>
      </div>

      <div className="panel">
        <h3>Ready to explore more?</h3>

        <p>
          Open Advanced Analysis to run the existing prediction
          model and inspect its feature explanations.
        </p>

        <button
          type="button"
          className="primary-button"
          onClick={openAnalysis}
        >
          Explore Advanced Analysis →
        </button>

        <div style={{ marginTop: "16px" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setShowTechnical((visible) => !visible)
            }
          >
            {showTechnical
              ? "Hide technical details"
              : "Show technical details"}
          </button>
        </div>

        {showTechnical && (
          <div
            className="detail-list"
            style={{ marginTop: "16px" }}
          >
            <Detail
              label="Model name"
              value={
                model?.model ||
                model?.model_name ||
                "Not provided"
              }
            />

            <Detail
              label="Lookback"
              value={model?.lookback ?? "Not provided"}
            />

            <Detail
              label="Prediction target"
              value={model?.target || "Not provided"}
            />

            <Detail
              label="Feature count"
              value={
                model?.feature_count ??
                (Array.isArray(model?.features)
                  ? model.features.length
                  : "Not provided")
              }
            />
          </div>
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{String(value)}</strong>
    </div>
  );
}

function Chart({ history }) {
  const points = history
    .map((item) => ({
      ...item,
      n: Number(item.deviation),
    }))
    .filter((item) => Number.isFinite(item.n));

  if (!points.length) {
    return (
      <div className="empty-state">
        No numeric deviation values were returned by the API.
      </div>
    );
  }

  const width = 900;
  const height = 300;
  const pad = 35;

  const min = Math.min(0, ...points.map((point) => point.n));
  const max = Math.max(0, ...points.map((point) => point.n));
  const range = max - min || 1;

  const coords = points.map((point, index) => ({
    ...point,
    x:
      pad +
      (index / Math.max(points.length - 1, 1)) *
        (width - pad * 2),
    y:
      pad +
      ((max - point.n) / range) * (height - pad * 2),
  }));

  const polyline = coords
    .map((point) => `${point.x},${point.y}`)
    .join(" ");

  const zeroY =
    pad + (max / range) * (height - pad * 2);

  return (
    <div className="chart-wrap">
      <p className="muted">
        Each point represents a historical observation. Hover
        over a point to see its available details.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        aria-label="Historical PCP deviation chart"
      >
        {[0, 1, 2, 3, 4].map((index) => {
          const y =
            pad + (index / 4) * (height - pad * 2);

          return (
            <line
              key={index}
              x1={pad}
              y1={y}
              x2={width - pad}
              y2={y}
              className="grid-line"
            />
          );
        })}

        {min <= 0 && max >= 0 && (
          <line
            x1={pad}
            y1={zeroY}
            x2={width - pad}
            y2={zeroY}
            className="zero-line"
          />
        )}

        <polyline
          points={polyline}
          className="chart-line"
        />

        {coords.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            className="chart-point"
          >
            <title>
              {`${point.date || "Date unavailable"} | Deviation: ${formatNumber(point.n)} | Signal: ${point.signal || "Not provided"}`}
            </title>
          </circle>
        ))}
      </svg>

      <div className="chart-range">
        <span>
          Lowest: {formatNumber(Math.min(...points.map((p) => p.n)))}
        </span>

        <span>
          Highest: {formatNumber(Math.max(...points.map((p) => p.n)))}
        </span>
      </div>
    </div>
  );
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toLocaleString(undefined, {
        maximumFractionDigits: 4,
      })
    : String(value);
}