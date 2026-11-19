# ============================================================
# PCP AI - PREDICTOR
# Hybrid LSTM-Transformer
# Manual Prediction + Latest Prediction
# ============================================================

import os
import json
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.preprocessing import MinMaxScaler


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_DIR = os.path.join(
    BASE_DIR,
    "models",
    "hybrid_lstm_transformer.keras"
)

CONFIG_PATH = os.path.join(
    MODEL_DIR,
    "config.json"
)

WEIGHTS_PATH = os.path.join(
    MODEL_DIR,
    "model.weights.h5"
)

CSV_PATH = os.path.join(
    BASE_DIR,
    "data",
    "PCP_TRAINING_DATASET.csv"
)


# ============================================================
# MODEL SETTINGS
# ============================================================

LOOKBACK = 30

BUY_THRESHOLD = 500
SELL_THRESHOLD = -500

FEATURES = [
    "SpotPrice_CE",
    "STRIKE_PR",
    "CLOSE_CE",
    "CLOSE_PE",
    "OPEN_INT_CE",
    "OPEN_INT_PE",
    "T"
]

TARGET = "PCP_Deviation"


# ============================================================
# CACHE
# ============================================================

_model = None
_prediction_df = None
_scaler = None
_simulation_cache = {}


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():

    global _model

    if _model is not None:
        return _model

    print("\nLoading Hybrid LSTM-Transformer model...")

    # --------------------------------------------------------
    # FIRST OPTION:
    # Load complete .keras model directly.
    #
    # This is important because the saved architecture must
    # match the saved weights exactly.
    # --------------------------------------------------------

    if os.path.isfile(MODEL_DIR):

        try:

            print("Found complete .keras model.")
            print("Loading model directly...")

            _model = tf.keras.models.load_model(
                MODEL_DIR,
                compile=False
            )

            print(
                "Hybrid LSTM-Transformer model loaded successfully."
            )

            print(
                "Model input shape:",
                _model.input_shape
            )

            print(
                "Model output shape:",
                _model.output_shape
            )

            return _model

        except Exception as direct_error:

            print(
                "Direct .keras loading failed:"
            )

            print(direct_error)

    # --------------------------------------------------------
    # FALLBACK:
    # Reconstruct from config + weights.
    #
    # This is only used if the .keras file is not a complete
    # model file.
    # --------------------------------------------------------

    if not os.path.exists(CONFIG_PATH):

        raise FileNotFoundError(
            f"Model config not found:\n{CONFIG_PATH}"
        )

    if not os.path.exists(WEIGHTS_PATH):

        raise FileNotFoundError(
            f"Model weights not found:\n{WEIGHTS_PATH}"
        )

    print(
        "Attempting model reconstruction from config..."
    )

    try:

        with open(
            CONFIG_PATH,
            "r",
            encoding="utf-8"
        ) as file:

            model_config = json.load(file)

        _model = tf.keras.utils.deserialize_keras_object(
            model_config
        )

        if not _model.built:

            _model.build(
                input_shape=(
                    None,
                    LOOKBACK,
                    len(FEATURES)
                )
            )

        _model.load_weights(
            WEIGHTS_PATH
        )

        print(
            "Model weights loaded successfully."
        )

        return _model

    except Exception as e:

        raise RuntimeError(
            "Unable to load the Hybrid "
            "LSTM-Transformer model.\n\n"
            "The saved architecture and weights "
            "appear to be different.\n\n"
            f"Original error:\n{e}"
        )


# ============================================================
# LOAD DATASET
# ============================================================

def load_prediction_data():

    global _prediction_df

    if _prediction_df is not None:
        return _prediction_df

    if not os.path.exists(CSV_PATH):

        raise FileNotFoundError(
            f"Prediction dataset not found:\n{CSV_PATH}"
        )

    print("\nLoading prediction dataset...")

    df = pd.read_csv(
        CSV_PATH,
        low_memory=False
    )

    print(
        f"Dataset loaded: "
        f"{df.shape[0]} rows, "
        f"{df.shape[1]} columns"
    )

    missing_features = [
        column
        for column in FEATURES
        if column not in df.columns
    ]

    if missing_features:

        raise ValueError(
            "Required model features are missing: "
            + str(missing_features)
        )

    # --------------------------------------------------------
    # Numeric conversion
    # --------------------------------------------------------

    for column in FEATURES:

        df[column] = pd.to_numeric(
            df[column],
            errors="coerce"
        )

    # --------------------------------------------------------
    # Remove invalid rows
    # --------------------------------------------------------

    df = df.dropna(
        subset=FEATURES
    ).copy()

    if len(df) < LOOKBACK:

        raise ValueError(
            f"Not enough valid rows. "
            f"Need at least {LOOKBACK} rows."
        )

    # --------------------------------------------------------
    # Timestamp
    # --------------------------------------------------------

    if "TIMESTAMP" in df.columns:

        df["TIMESTAMP_PARSED"] = pd.to_datetime(
            df["TIMESTAMP"],
            errors="coerce"
        )

        if df["TIMESTAMP_PARSED"].notna().any():

            df = df.sort_values(
                "TIMESTAMP_PARSED"
            ).reset_index(drop=True)

    else:

        df["TIMESTAMP_PARSED"] = pd.NaT

    _prediction_df = df

    print(
        f"Clean prediction rows: {len(df)}"
    )

    return _prediction_df


# ============================================================
# SCALER
# ============================================================

def get_scaler():

    global _scaler

    if _scaler is not None:
        return _scaler

    df = load_prediction_data()

    _scaler = MinMaxScaler()

    _scaler.fit(
        df[FEATURES]
    )

    return _scaler


# ============================================================
# SCALED FEATURES
# ============================================================

def get_scaled_features():

    df = load_prediction_data()

    scaler = get_scaler()

    return scaler.transform(
        df[FEATURES]
    ).astype(
        np.float32
    )


# ============================================================
# SIGNAL GENERATION
# ============================================================

def generate_signal(deviation):

    deviation = float(deviation)

    if deviation > BUY_THRESHOLD:

        return {
            "signal": "BUY",
            "strategy": "Buy Call / Sell Put",
            "rationale": (
                "The predicted PCP deviation is above "
                "the positive arbitrage threshold."
            )
        }

    if deviation < SELL_THRESHOLD:

        return {
            "signal": "SELL",
            "strategy": "Buy Put / Sell Call",
            "rationale": (
                "The predicted PCP deviation is below "
                "the negative arbitrage threshold."
            )
        }

    return {
        "signal": "HOLD",
        "strategy": "No Arbitrage",
        "rationale": (
            "The predicted deviation is within "
            "the configured arbitrage threshold range."
        )
    }


# ============================================================
# LATEST SEQUENCE
# ============================================================

def prepare_latest_sequence():

    scaled = get_scaled_features()

    if len(scaled) < LOOKBACK:

        raise ValueError(
            "Not enough data for prediction."
        )

    sequence = scaled[-LOOKBACK:]

    X = np.expand_dims(
        sequence,
        axis=0
    )

    return X.astype(
        np.float32
    )


# ============================================================
# LATEST PREDICTION
# ============================================================

def predict_latest_deviation():

    model = load_model()

    df = load_prediction_data()

    X = prepare_latest_sequence()

    prediction = model.predict(
        X,
        verbose=0
    )

    prediction_value = float(
        np.asarray(prediction)
        .reshape(-1)[0]
    )

    return prediction_value, df


# ============================================================
# LATEST SIGNAL
# ============================================================

def get_latest_signal():

    deviation, df = predict_latest_deviation()

    signal_data = generate_signal(
        deviation
    )

    date_value = "Latest available"

    if (
        "TIMESTAMP_PARSED" in df.columns
        and
        df["TIMESTAMP_PARSED"].notna().any()
    ):

        date_value = (
            df["TIMESTAMP_PARSED"]
            .iloc[-1]
            .strftime("%Y-%m-%d")
        )

    return {

        "success": True,

        "date": date_value,

        "deviation": round(
            deviation,
            4
        ),

        "signal": signal_data["signal"],

        "strategy": signal_data["strategy"],

        "rationale": signal_data["rationale"],

        "confidence": None,

        "lookback": LOOKBACK,

        "thresholds": {
            "buy": BUY_THRESHOLD,
            "sell": SELL_THRESHOLD
        }
    }


# ============================================================
# CUSTOM INPUT SEQUENCE
#
# 29 historical rows + 1 user row = 30 timesteps
# ============================================================

def prepare_custom_sequence(user_data):

    df = load_prediction_data()

    scaler = get_scaler()

    if len(df) < LOOKBACK - 1:

        raise ValueError(
            f"Need at least {LOOKBACK - 1} "
            "historical rows."
        )

    # --------------------------------------------------------
    # Validate input
    # --------------------------------------------------------

    missing = [
        feature
        for feature in FEATURES
        if feature not in user_data
    ]

    if missing:

        raise ValueError(
            "Missing model input features: "
            + str(missing)
        )

    values = {}

    for feature in FEATURES:

        try:

            value = float(
                user_data[feature]
            )

        except Exception:

            raise ValueError(
                f"Invalid value for {feature}."
            )

        if not np.isfinite(value):

            raise ValueError(
                f"{feature} must be a finite number."
            )

        values[feature] = value

    # --------------------------------------------------------
    # Last 29 historical rows
    # --------------------------------------------------------

    historical = (
        df[FEATURES]
        .iloc[-(LOOKBACK - 1):]
        .copy()
    )

    # --------------------------------------------------------
    # New user row
    # --------------------------------------------------------

    custom_row = pd.DataFrame(
        [values],
        columns=FEATURES
    )

    # --------------------------------------------------------
    # Combine
    # --------------------------------------------------------

    combined = pd.concat(
        [
            historical,
            custom_row
        ],
        ignore_index=True
    )

    # --------------------------------------------------------
    # Scale using same training-data scaler
    # --------------------------------------------------------

    scaled = scaler.transform(
        combined[FEATURES]
    ).astype(
        np.float32
    )

    if scaled.shape != (
        LOOKBACK,
        len(FEATURES)
    ):

        raise ValueError(
            "Invalid model input shape: "
            + str(scaled.shape)
        )

    X = np.expand_dims(
        scaled,
        axis=0
    )

    return X.astype(
        np.float32
    )


# ============================================================
# CUSTOM PREDICTION
# ============================================================

def get_custom_prediction(user_data):

    model = load_model()

    X = prepare_custom_sequence(
        user_data
    )

    prediction = model.predict(
        X,
        verbose=0
    )

    deviation = float(
        np.asarray(prediction)
        .reshape(-1)[0]
    )

    signal_data = generate_signal(
        deviation
    )

    return {

        "success": True,

        "date": "Manual input",

        "deviation": round(
            deviation,
            4
        ),

        "prediction": round(
            deviation,
            4
        ),

        "signal": signal_data["signal"],

        "strategy": signal_data["strategy"],

        "rationale": signal_data["rationale"],

        "lookback": LOOKBACK,

        "thresholds": {
            "buy": BUY_THRESHOLD,
            "sell": SELL_THRESHOLD
        },

        "input": {
            key: float(value)
            for key, value in user_data.items()
        }
    }


# ============================================================
# HISTORICAL DATA API
# Kept for backend compatibility.
# UI does not use it.
# ============================================================

def get_deviation_data(days=60):

    df = load_prediction_data()

    days = max(
        10,
        min(int(days), 120)
    )

    scaled = get_scaled_features()

    model = load_model()

    results = []

    start_index = max(
        LOOKBACK,
        len(scaled) - days
    )

    for index in range(
        start_index,
        len(scaled)
    ):

        sequence = scaled[
            index - LOOKBACK:index
        ]

        X = np.expand_dims(
            sequence,
            axis=0
        )

        prediction = model.predict(
            X,
            verbose=0
        )

        deviation = float(
            np.asarray(prediction)
            .reshape(-1)[0]
        )

        signal_data = generate_signal(
            deviation
        )

        if (
            "TIMESTAMP_PARSED" in df.columns
            and
            pd.notna(
                df["TIMESTAMP_PARSED"].iloc[index]
            )
        ):

            date = (
                df["TIMESTAMP_PARSED"]
                .iloc[index]
                .strftime("%Y-%m-%d")
            )

        else:

            date = str(index)

        results.append({

            "date": date,

            "deviation": round(
                deviation,
                4
            ),

            "signal": signal_data["signal"]
        })

    return {
        "success": True,
        "data": results
    }


# ============================================================
# MODEL INFO
# ============================================================

def get_model_info():

    model = load_model()

    return {

        "success": True,

        "model": "Hybrid LSTM-Transformer",

        "lookback": LOOKBACK,

        "features": FEATURES,

        "feature_count": len(FEATURES),

        "input_shape": str(
            model.input_shape
        ),

        "output_shape": str(
            model.output_shape
        ),

        "target": TARGET,

        "buy_threshold": BUY_THRESHOLD,

        "sell_threshold": SELL_THRESHOLD
    }


# ============================================================
# SIMULATION COMPATIBILITY
# ============================================================

def get_simulation_data(points=60):

    return get_deviation_data(
        points
    )