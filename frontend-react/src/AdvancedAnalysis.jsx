
import { useState } from "react";

const API = "http://127.0.0.1:8000";
const TOKEN = "pcp_react_token";

const fields = [
  {
    name: "spot_price",
    label: "Spot price",
    description: "Current underlying asset price",
    step: "any",
    min: "0",
    placeholder: "e.g. 2500",
  },
  {
    name: "strike_price",
    label: "Strike price",
    description: "Contract's agreed exercise price",
    step: "any",
    min: "0",
    placeholder: "e.g. 2500",
  },
  {
    name: "call_price",
    label: "Call option price",
    description: "Price of the call option",
    step: "any",
    min: "0",
    placeholder: "e.g. 100",
  },
  {
    name: "put_price",
    label: "Put option price",
    description: "Price of the put option",
    step: "any",
    min: "0",
    placeholder: "e.g. 80",
  },
  {
    name: "call_open_interest",
    label: "Call open interest",
    description: "Open contracts for calls",
    step: "any",
    min: "0",
    placeholder: "e.g. 15000",
  },
  {
    name: "put_open_interest",
    label: "Put open interest",
    description: "Open contracts for puts",
    step: "any",
    min: "0",
    placeholder: "e.g. 12000",
  },
  {
    name: "time_to_expiry",
    label: "Time to expiry (T)",
    description: "Use the same time unit as your training data",
    step: "any",
    min: "0",
    placeholder: "e.g. 0.05",
  },
];

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem(TOKEN);

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
      ...options.headers,
    },
  });

  const contentType =
    response.headers.get("content-type") || "";

  const data = contentType.includes("application/json")
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

function signalClass(signal) {
  const value = String(signal || "").toLowerCase();

  if (value === "buy") return "analysis-buy";
  if (value === "sell") return "analysis-sell";

  return "analysis-hold";
}

export default function AdvancedAnalysis({
  signal,
  model,
}) {
  const [inputs, setInputs] = useState({
    spot_price: "",
    strike_price: "",
    call_price: "",
    put_price: "",
    call_open_interest: "",
    put_open_interest: "",
    time_to_expiry: "",
  });

  const [prediction, setPrediction] = useState(null);
  const [explanation, setExplanation] = useState(null);

  const [predicting, setPredicting] = useState(false);
  const [explaining, setExplaining] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function handleInputChange(event) {
    const { name, value } = event.target;

    setInputs((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function getPayload() {
    const payload = {};

    for (const field of fields) {
      const raw = inputs[field.name];

      if (raw.trim() === "") {
        throw new Error(
          `Please enter ${field.label.toLowerCase()}.`
        );
      }

      const value = Number(raw);

      if (!Number.isFinite(value) || value < 0) {
        throw new Error(
          `${field.label} must be a valid, non-negative number.`
        );
      }

      payload[field.name] = value;
    }

    return payload;
  }

  async function runPrediction(event) {
    event.preventDefault();

    setError("");
    setNotice("");
    setPrediction(null);
    setExplanation(null);
    setPredicting(true);

    try {
      const payload = getPayload();

      const result = await apiRequest("/api/predict", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setPrediction(result);
      setNotice(
        "Prediction received from your backend model."
      );
    } catch (err) {
      setError(
        err.message || "Unable to run the AI prediction."
      );
    } finally {
      setPredicting(false);
    }
  }

  async function runExplanation() {
    setError("");
    setNotice("");
    setExplanation(null);
    setExplaining(true);

    try {
      const payload = getPayload();

      const result = await apiRequest("/api/xai", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!Array.isArray(result?.explanation)) {
        throw new Error(
          "The backend response did not contain the expected SHAP explanation."
        );
      }

      setExplanation(result);
      setNotice(
        "SHAP explanation received from your backend."
      );
    } catch (err) {
      setError(
        err.message ||
          "Unable to calculate the SHAP explanation."
      );
    } finally {
      setExplaining(false);
    }
  }

  const explanationItems = Array.isArray(
    explanation?.explanation
  )
    ? explanation.explanation
    : [];

  const largestImportance = Math.max(
    0,
    ...explanationItems.map((item) =>
      Math.abs(Number(item.importance) || 0)
    )
  );

  const activeSignal =
    prediction?.signal || signal?.signal || "Not available";

  return (
    <section className="content advanced-analysis">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">MODEL WORKSPACE</p>
          <h2>Advanced Analysis</h2>
          <p>
            Enter option data to request a prediction from your
            existing model, then explore its SHAP explanation.
          </p>
        </div>

        <span
          className={`analysis-signal ${signalClass(activeSignal)}`}
        >
          {activeSignal}
        </span>
      </div>

      <div className="panel">
        <p className="eyebrow">01 · INPUT DATA</p>
        <h3>Run an AI prediction</h3>
        <p>
          Complete all seven fields. The backend combines your
          input with its last 29 historical rows to create the
          30-timestep model sequence.
        </p>

        <form onSubmit={runPrediction}>
          <div className="analysis-form-grid">
            {fields.map((field) => (
              <div
                className="analysis-field"
                key={field.name}
              >
                <label htmlFor={field.name}>
                  {field.label}
                </label>

                <input
                  id={field.name}
                  name={field.name}
                  type="number"
                  min={field.min}
                  step={field.step}
                  inputMode="decimal"
                  placeholder={field.placeholder}
                  value={inputs[field.name]}
                  onChange={handleInputChange}
                  required
                />

                <small>{field.description}</small>
              </div>
            ))}
          </div>

          <div className="analysis-actions">
            <button
              type="submit"
              className="primary-button"
              disabled={predicting || explaining}
            >
              {predicting
                ? "Running model..."
                : "Run AI prediction →"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={runExplanation}
              disabled={predicting || explaining}
            >
              {explaining
                ? "Calculating SHAP..."
                : "Explain these inputs"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setInputs({
                  spot_price: "",
                  strike_price: "",
                  call_price: "",
                  put_price: "",
                  call_open_interest: "",
                  put_open_interest: "",
                  time_to_expiry: "",
                });
                setPrediction(null);
                setExplanation(null);
                setError("");
                setNotice("");
              }}
              disabled={predicting || explaining}
            >
              Clear form
            </button>
          </div>
        </form>

        <p className="muted analysis-note">
          Use appropriate values from your dataset. Example
          numbers are illustrative only. The model does not fetch
          live market prices through this form.
        </p>
      </div>

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

      {prediction && (
        <div className="panel">
          <p className="eyebrow">02 · MODEL OUTPUT</p>
          <h3>Prediction result</h3>

          <div className="analysis-result-grid">
            <div className="analysis-result-card">
              <span>Predicted deviation</span>
              <strong>
                {formatNumber(
                  prediction.deviation ??
                    prediction.prediction
                )}
              </strong>
              <small>Returned by your model</small>
            </div>

            <div className="analysis-result-card">
              <span>Model signal</span>
              <strong
                className={signalClass(prediction.signal)}
              >
                {prediction.signal || "Not provided"}
              </strong>
              <small>Backend-generated label</small>
            </div>

            <div className="analysis-result-card">
              <span>Sequence length</span>
              <strong>
                {prediction.lookback ?? "—"}
              </strong>
              <small>Timesteps used by the model</small>
            </div>
          </div>

          <div className="detail-list">
            <div className="detail-row">
              <span>Suggested strategy label</span>
              <strong>
                {prediction.strategy || "Not provided"}
              </strong>
            </div>

            <div className="detail-row">
              <span>Model rationale</span>
              <strong>
                {prediction.rationale || "Not provided"}
              </strong>
            </div>

            <div className="detail-row">
              <span>Buy threshold</span>
              <strong>
                {formatNumber(prediction.thresholds?.buy)}
              </strong>
            </div>

            <div className="detail-row">
              <span>Sell threshold</span>
              <strong>
                {formatNumber(prediction.thresholds?.sell)}
              </strong>
            </div>
          </div>

          <p className="muted analysis-note">
            This is a model output, not a verified arbitrage
            opportunity or a guarantee of profit. Validate data,
            pricing assumptions, transaction costs, and market
            conditions independently.
          </p>
        </div>
      )}

      {explanation && (
        <div className="panel">
          <p className="eyebrow">03 · EXPLAINABLE AI</p>
          <h3>Why did the model produce this result?</h3>

          <p>
            SHAP estimates how input features contribute to the
            model output relative to its background data. Your
            backend averages contributions across the 30 timesteps.
          </p>

          <div className="detail-list">
            <div className="detail-row">
              <span>Explainer used</span>
              <strong>
                {explanation.explainer || "Not provided"}
              </strong>
            </div>

            <div className="detail-row">
              <span>Explained prediction</span>
              <strong>
                {formatNumber(explanation.prediction)}
              </strong>
            </div>

            <div className="detail-row">
              <span>Explained signal</span>
              <strong>{explanation.signal || "—"}</strong>
            </div>
          </div>

          {explanationItems.length === 0 ? (
            <p className="muted">
              The backend returned no feature explanations.
            </p>
          ) : (
            <div className="shap-list">
              <h4>Feature importance</h4>
              <p className="muted">
                Longer bars indicate higher mean absolute SHAP
                importance among these seven features.
              </p>

              {explanationItems.map((item, index) => {
                const importance =
                  Math.abs(Number(item.importance) || 0);

                const contribution =
                  Number(item.contribution) || 0;

                const width =
                  largestImportance > 0
                    ? (importance / largestImportance) * 100
                    : 0;

                return (
                  <div
                    className="shap-item"
                    key={`${item.feature}-${index}`}
                  >
                    <div className="shap-item-heading">
                      <strong>
                        {item.feature || "Unknown feature"}
                      </strong>

                      <span>
                        Importance: {formatNumber(importance)}
                      </span>
                    </div>

                    <div
                      className="shap-track"
                      aria-label={`Relative importance ${width.toFixed(1)} percent`}
                    >
                      <div
                        className="shap-bar"
                        style={{ width: `${width}%` }}
                      />
                    </div>

                    <div className="shap-item-meta">
                      <span>
                        Input: {formatNumber(item.value)}
                      </span>

                      <span>
                        Contribution:{" "}
                        {formatNumber(contribution)}
                      </span>

                      <span>
                        Direction: {item.direction || "Unknown"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="muted analysis-note">
            Feature importance indicates relative influence,
            not certainty or causation. The contribution direction
            is the direction reported by your SHAP implementation;
            it should not be interpreted as a direct buy/sell
            recommendation.
          </p>
        </div>
      )}

      <div className="panel">
        <p className="eyebrow">MODEL DETAILS</p>
        <h3>Your current model</h3>

        <div className="detail-list">
          <div className="detail-row">
            <span>Architecture</span>
            <strong>
              {model?.model || "Hybrid LSTM-Transformer"}
            </strong>
          </div>

          <div className="detail-row">
            <span>Sequence length</span>
            <strong>{model?.lookback ?? 30}</strong>
          </div>

          <div className="detail-row">
            <span>Input feature count</span>
            <strong>
              {model?.feature_count ?? fields.length}
            </strong>
          </div>

          <div className="detail-row">
            <span>Prediction target</span>
            <strong>
              {model?.target || "PCP_Deviation"}
            </strong>
          </div>
        </div>
      </div>
    </section>
  );
}
