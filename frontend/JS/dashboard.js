
/* ============================================================
   PCP AI - DASHBOARD
============================================================ */

const API_BASE = "";

let shapChart = null;
let lastPredictionPayload = null;


/* ============================================================
   COMPANY SELECTION
============================================================ */

function setupCompanySelector() {
    const companySelect = document.getElementById("companySelect");

    if (!companySelect) {
        return;
    }

    // Preserve the selected company; default to RELIANCE.
    window.selectedCompany = companySelect.value || "RELIANCE";

    companySelect.addEventListener("change", function () {
        window.selectedCompany = companySelect.value;

        const selectedOption =
            companySelect.options[companySelect.selectedIndex];

        const companyLabel =
            document.getElementById("selectedCompany");

        if (companyLabel && selectedOption) {
            companyLabel.textContent = selectedOption.text;
        }

        console.log("Selected company:", window.selectedCompany);
    });
}


/* ============================================================
   AUTH
============================================================ */

function getToken() {
    return (
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("jwt")
    );
}


function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("jwt");
    localStorage.removeItem("email");

    window.location.href = "/";
}


/* ============================================================
   API HELPER
============================================================ */

async function apiFetch(url, options = {}) {
    const headers = {
        ...(options.headers || {})
    };

    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const token = getToken();

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(API_BASE + url, {
        ...options,
        headers
    });

    const contentType =
        response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        let message = "Request failed.";

        if (data && typeof data === "object") {
            message = data.detail || data.message || message;
        } else if (data) {
            message = data;
        }

        throw new Error(message);
    }

    return data;
}


/* ============================================================
   FORMATTERS
============================================================ */

function formatNumber(value, digits = 2) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "—";
    }

    return number.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
}


function displaySignal(signal) {
    const value = String(signal || "").toUpperCase();

    if (value === "HOLD") {
        return "NO ARBITRAGE";
    }

    return value || "—";
}


function signalClass(signal) {
    const value = String(signal || "").toUpperCase();

    if (value === "BUY") {
        return "buy";
    }

    if (value === "SELL") {
        return "sell";
    }

    return "hold";
}


/* ============================================================
   LATEST SIGNAL
============================================================ */

async function loadLatestSignal() {
    const bigSignal = document.getElementById("bigSignal");
    const deviation = document.getElementById("bigDeviation");
    const rationale = document.getElementById("signalRationale");

    try {
        const data = await apiFetch("/api/signal");

        if (!data.success) {
            throw new Error(data.message || "Unable to load signal.");
        }

        if (deviation) {
            deviation.textContent = formatNumber(data.deviation, 2);
        }

        if (bigSignal) {
            bigSignal.textContent = displaySignal(data.signal);
            bigSignal.className =
                `big-signal ${signalClass(data.signal)}`;
        }

        if (rationale) {
            rationale.textContent =
                data.rationale || "No rationale available.";
        }

        const strategy = document.getElementById("strategyText");

        if (strategy) {
            strategy.textContent = data.strategy || "—";
        }

        const date = document.getElementById("signalDate");

        if (date) {
            date.textContent = data.date || "—";
        }

        const lookback = document.getElementById("signalLookback");

        if (lookback) {
            lookback.textContent =
                `${data.lookback || 30} Timesteps`;
        }

        const buyThreshold = document.getElementById("buyThreshold");

        if (buyThreshold) {
            buyThreshold.textContent =
                `+${formatNumber(data.thresholds?.buy ?? 500, 0)}`;
        }

        const sellThreshold =
            document.getElementById("sellThreshold");

        if (sellThreshold) {
            sellThreshold.textContent =
                formatNumber(data.thresholds?.sell ?? -500, 0);
        }

    } catch (error) {
        console.error("Signal error:", error);

        if (bigSignal) {
            bigSignal.textContent = "ERROR";
            bigSignal.className = "big-signal hold";
        }

        if (rationale) {
            rationale.textContent = error.message;
        }
    }
}


/* ============================================================
   MODEL INFO
============================================================ */

async function loadModelInfo() {
    try {
        const data = await apiFetch("/api/model-info");

        if (!data.success) {
            return;
        }

        const lookback = document.getElementById("modelLookback");

        if (lookback) {
            lookback.textContent = data.lookback || "30";
        }

        const count =
            document.getElementById("modelFeatureCount");

        if (count) {
            count.textContent =
                data.feature_count ||
                data.features?.length ||
                "7";
        }

    } catch (error) {
        console.error("Model info error:", error);
    }
}


/* ============================================================
   MANUAL PREDICTION
============================================================ */

function getInputValue(id) {
    const element = document.getElementById(id);

    if (!element) {
        return NaN;
    }

    return Number(element.value);
}


function collectPredictionPayload() {
    return {
        spot_price: getInputValue("predictSpot"),
        strike_price: getInputValue("predictStrike"),
        call_price: getInputValue("predictCall"),
        put_price: getInputValue("predictPut"),
        call_open_interest: getInputValue("predictCallOI"),
        put_open_interest: getInputValue("predictPutOI"),
        time_to_expiry: getInputValue("predictT")
    };
}


function validatePredictionPayload(payload) {
    const names = {
        spot_price: "Spot Price",
        strike_price: "Strike Price",
        call_price: "Call Price",
        put_price: "Put Price",
        call_open_interest: "Call Open Interest",
        put_open_interest: "Put Open Interest",
        time_to_expiry: "Time to Expiry"
    };

    for (const [key, value] of Object.entries(payload)) {
        if (!Number.isFinite(value)) {
            return `${names[key]} is required.`;
        }

        if (value < 0) {
            return `${names[key]} cannot be negative.`;
        }
    }

    return null;
}


function renderPredictionResult(data) {
    const deviation =
        document.getElementById("predictionDeviation");

    const signal =
        document.getElementById("predictionSignal");

    const strategy =
        document.getElementById("predictionStrategy");

    if (deviation) {
        deviation.textContent =
            formatNumber(data.deviation ?? data.prediction, 2);
    }

    if (signal) {
        signal.textContent = displaySignal(data.signal);
        signal.className =
            `prediction-signal ${signalClass(data.signal)}`;
    }

    if (strategy) {
        strategy.textContent = data.strategy || "—";
    }

    const bigDeviation = document.getElementById("bigDeviation");
    const bigSignal = document.getElementById("bigSignal");
    const rationale = document.getElementById("signalRationale");
    const strategyText = document.getElementById("strategyText");
    const date = document.getElementById("signalDate");

    if (bigDeviation) {
        bigDeviation.textContent =
            formatNumber(data.deviation ?? data.prediction, 2);
    }

    if (bigSignal) {
        bigSignal.textContent = displaySignal(data.signal);
        bigSignal.className =
            `big-signal ${signalClass(data.signal)}`;
    }

    if (rationale) {
        rationale.textContent = data.rationale || "—";
    }

    if (strategyText) {
        strategyText.textContent = data.strategy || "—";
    }

    if (date) {
        date.textContent = "Manual input";
    }
}


async function runCustomPrediction() {
    const message =
        document.getElementById("predictionFormMessage");

    const button =
        document.getElementById("runPredictionButton");

    const payload = collectPredictionPayload();

    const validationError =
        validatePredictionPayload(payload);

    if (validationError) {
        if (message) {
            message.textContent = validationError;
            message.className = "prediction-status error";
        }

        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Running Model...";
    }

    if (message) {
        message.textContent =
            "Sending input to Hybrid LSTM–Transformer...";
        message.className = "prediction-status";
    }

    try {
        const data = await apiFetch("/api/predict", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        lastPredictionPayload = payload;

        renderPredictionResult(data);

        if (message) {
            message.textContent =
                "Prediction generated successfully.";
            message.className = "prediction-status success";
        }

        await loadCustomXAI(payload);

    } catch (error) {
        console.error("Prediction error:", error);

        if (message) {
            message.textContent =
                `Prediction failed: ${error.message}`;
            message.className = "prediction-status error";
        }

    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = "Run AI Prediction";
        }
    }
}


/* ============================================================
   CUSTOM XAI
============================================================ */

async function loadCustomXAI(payload) {
    const summary = document.getElementById("xaiSummary");

    if (summary) {
        summary.textContent =
            "Calculating dynamic SHAP explanation...";
    }

    try {
        const data = await apiFetch("/api/xai", {
            method: "POST",
            body: JSON.stringify(payload)
        });

        renderXAI(data);

    } catch (error) {
        console.error("XAI error:", error);

        if (summary) {
            summary.textContent =
                `SHAP explanation failed: ${error.message}`;
        }
    }
}


/* ============================================================
   LATEST XAI
============================================================ */

async function loadXAI() {
    try {
        const data = await apiFetch("/api/xai");
        renderXAI(data);

    } catch (error) {
        console.error("XAI error:", error);

        const summary = document.getElementById("xaiSummary");

        if (summary) {
            summary.textContent =
                `Explanation unavailable: ${error.message}`;
        }
    }
}


/* ============================================================
   XAI RENDER
============================================================ */

function renderXAI(data) {
    const summary = document.getElementById("xaiSummary");

    if (!data.success) {
        if (summary) {
            summary.textContent = "No explanation available.";
        }

        return;
    }

    if (summary) {
        summary.innerHTML = `
            <div class="xai-summary-grid">
                <div>
                    <span>Prediction</span>
                    <strong>${formatNumber(data.prediction, 2)}</strong>
                </div>

                <div>
                    <span>Signal</span>
                    <strong class="xai-signal ${signalClass(data.signal)}">
                        ${displaySignal(data.signal)}
                    </strong>
                </div>

                <div>
                    <span>Explainer</span>
                    <strong>${data.explainer || "SHAP"}</strong>
                </div>

                <div>
                    <span>Sequence</span>
                    <strong>${data.lookback || 30} Timesteps</strong>
                </div>
            </div>

            <p>${data.rationale || ""}</p>
        `;
    }

    renderSHAPChart(data.explanation || []);
    renderFeatureList(data.explanation || []);
}


/* ============================================================
   SHAP CHART
============================================================ */

function renderSHAPChart(explanation) {
    const canvas = document.getElementById("shapChart");

    if (!canvas) {
        return;
    }

    const labels = explanation.map(item => item.feature);

    const values = explanation.map(
        item => Number(item.contribution || 0)
    );

    if (shapChart) {
        shapChart.destroy();
        shapChart = null;
    }

    shapChart = new Chart(canvas.getContext("2d"), {
        type: "bar",

        data: {
            labels,
            datasets: [{
                label: "SHAP Contribution",
                data: values,
                borderWidth: 0,
                borderRadius: 6
            }]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: "y",

            plugins: {
                legend: {
                    display: false
                },

                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return (
                                " Contribution: " +
                                formatNumber(context.raw, 4)
                            );
                        }
                    }
                }
            },

            scales: {
                x: {
                    grid: {
                        color: "rgba(255,255,255,0.06)"
                    },

                    ticks: {
                        color: "#8f98a6"
                    }
                },

                y: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#d9dee7"
                    }
                }
            }
        }
    });
}


/* ============================================================
   FEATURE LIST
============================================================ */

function renderFeatureList(explanation) {
    const container = document.getElementById("featureList");

    if (!container) {
        return;
    }

    if (!explanation.length) {
        container.innerHTML =
            "<p>No feature explanation available.</p>";
        return;
    }

    const maxImportance = Math.max(
        ...explanation.map(
            item => Math.abs(Number(item.importance || 0))
        ),
        0.000001
    );

    container.innerHTML = explanation.map(item => {
        const importance =
            Math.abs(Number(item.importance || 0));

        const contribution =
            Number(item.contribution || 0);

        const width = Math.min(
            100,
            (importance / maxImportance) * 100
        );

        const direction =
            String(item.direction || "Neutral").toLowerCase();

        return `
            <div class="feature-row">
                <div class="feature-top">
                    <div>
                        <span class="feature-name">${item.feature}</span>
                        <span class="feature-direction ${direction}">
                            ${item.direction || "Neutral"}
                        </span>
                    </div>

                    <strong>${formatNumber(item.value, 2)}</strong>
                </div>

                <div class="feature-bar">
                    <div
                        class="feature-fill ${direction}"
                        style="width:${width}%"
                    ></div>
                </div>

                <div class="feature-bottom">
                    <span>
                        Importance: ${formatNumber(importance, 4)}
                    </span>

                    <span>
                        Contribution: ${formatNumber(contribution, 4)}
                    </span>
                </div>
            </div>
        `;
    }).join("");
}


/* ============================================================
   PCP CALCULATOR
============================================================ */

function calculatePCP() {
    const S = Number(document.getElementById("pcpSpot")?.value);
    const C = Number(document.getElementById("pcpCall")?.value);
    const P = Number(document.getElementById("pcpPut")?.value);
    const K = Number(document.getElementById("pcpStrike")?.value);
    const T = Number(document.getElementById("pcpTime")?.value);
    const r = Number(document.getElementById("pcpRate")?.value);
    const q = Number(document.getElementById("pcpDividend")?.value);

    const result =
        document.getElementById("pcpCalculatorResult");

    if (!result) {
        return;
    }

    const values = [S, C, P, K, T, r, q];

    if (values.some(value => !Number.isFinite(value))) {
        result.innerHTML = `
            <div class="calculator-result-message error">
                Please enter all calculator values.
            </div>
        `;
        return;
    }

    const theoretical =
        (S * Math.exp(-q * T)) - (K * Math.exp(-r * T));

    const observed = C - P;
    const deviation = observed - theoretical;

    result.innerHTML = `
        <div class="calculator-result-grid">
            <div class="calculator-result-item">
                <span>Theoretical C − P</span>
                <strong>${formatNumber(theoretical, 4)}</strong>
            </div>

            <div class="calculator-result-item">
                <span>Observed C − P</span>
                <strong>${formatNumber(observed, 4)}</strong>
            </div>

            <div class="calculator-result-item">
                <span>PCP Deviation</span>
                <strong>${formatNumber(deviation, 4)}</strong>
            </div>
        </div>

        <div class="calculator-result-message">
            ${
                deviation > 0
                    ? "Observed option prices are above theoretical parity."
                    : deviation < 0
                        ? "Observed option prices are below theoretical parity."
                        : "Observed prices are approximately at parity."
            }
        </div>
    `;
}


/* ============================================================
   SIDEBAR
============================================================ */

function setupPCPSidebar() {
    const sidebar = document.getElementById("pcpSidebar");
    const toggle = document.getElementById("pcpSidebarToggle");
    const links = document.querySelectorAll(".pcp-nav-link");

    if (toggle && sidebar) {
        toggle.addEventListener("click", function () {
            sidebar.classList.toggle("open");
        });
    }

    links.forEach(link => {
        link.addEventListener("click", function (event) {
            const href = link.getAttribute("href");

            if (href && href.startsWith("#")) {
                const target = document.querySelector(href);

                if (target) {
                    event.preventDefault();

                    target.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                    });
                }
            }

            links.forEach(item => {
                item.classList.remove("active");
            });

            link.classList.add("active");

            if (sidebar) {
                sidebar.classList.remove("open");
            }
        });
    });
}


/* ============================================================
   ACCOUNT
============================================================ */

function loadAccount() {
    const email = localStorage.getItem("email") || "User";

    const userEmail = document.getElementById("userEmail");
    const accountEmail = document.getElementById("accountEmail");

    if (userEmail) {
        userEmail.textContent = email;
    }

    if (accountEmail) {
        accountEmail.textContent = email;
    }
}


/* ============================================================
   INITIALIZATION
============================================================ */

document.addEventListener("DOMContentLoaded", async function () {
    const token = getToken();

    if (!token) {
        window.location.href = "/";
        return;
    }

    loadAccount();
    setupCompanySelector();
    setupPCPSidebar();

    const logoutButton = document.getElementById("logoutButton");

    if (logoutButton) {
        logoutButton.addEventListener("click", logout);
    }

    const refreshSignal = document.getElementById("refreshSignal");

    if (refreshSignal) {
        refreshSignal.addEventListener("click", loadLatestSignal);
    }

    const runButton =
        document.getElementById("runPredictionButton");

    if (runButton) {
        runButton.addEventListener("click", runCustomPrediction);
    }

    const explainButton = document.getElementById("explainButton");

    if (explainButton) {
        explainButton.addEventListener("click", async function () {
            if (lastPredictionPayload) {
                await loadCustomXAI(lastPredictionPayload);
            } else {
                await loadXAI();
            }
        });
    }

    const calculatorButton =
        document.getElementById("pcpCalculateBtn");

    if (calculatorButton) {
        calculatorButton.addEventListener("click", calculatePCP);
    }

    await loadLatestSignal();
    await loadModelInfo();
    await loadXAI();
});
