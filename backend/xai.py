# ============================================================
# PCP AI - EXPLAINABLE AI
# Dynamic SHAP for Hybrid LSTM-Transformer
# ============================================================

import numpy as np
import pandas as pd
import shap

from predictor import (
    load_model,
    get_scaled_features,
    load_prediction_data,
    prepare_custom_sequence,
    LOOKBACK,
    FEATURES,
    generate_signal
)


# ============================================================
# SETTINGS
# ============================================================

BACKGROUND_SIZE = 30


# ============================================================
# SHAP SHAPE NORMALIZATION
# ============================================================

def prepare_shap_array(shap_values):

    # SHAP may return a list for single-output models
    if isinstance(shap_values, list):

        if len(shap_values) == 0:
            raise RuntimeError(
                "SHAP returned an empty result."
            )

        shap_values = shap_values[0]

    shap_values = np.asarray(
        shap_values
    )

    # --------------------------------------------------------
    # Expected final shape:
    #
    # (samples, timesteps, features)
    #
    # Example:
    # (1, 30, 7)
    # --------------------------------------------------------

    if shap_values.ndim == 4:

        # Example:
        # (1, 30, 7, 1)

        if shap_values.shape[-1] == 1:

            shap_values = shap_values[..., 0]

        else:

            # For an unexpected output dimension,
            # use the first output.
            shap_values = shap_values[..., 0]

    elif shap_values.ndim == 3:

        pass

    elif shap_values.ndim == 2:

        # Some SHAP versions may return:
        # (30, 7)

        if shap_values.shape == (
            LOOKBACK,
            len(FEATURES)
        ):

            shap_values = np.expand_dims(
                shap_values,
                axis=0
            )

        else:

            raise RuntimeError(
                "Unexpected 2D SHAP shape: "
                + str(shap_values.shape)
            )

    else:

        raise RuntimeError(
            "Unexpected SHAP dimensions: "
            + str(shap_values.shape)
        )

    return shap_values


# ============================================================
# BACKGROUND SEQUENCES
# ============================================================

def get_background_sequences():

    scaled = get_scaled_features()

    if len(scaled) < LOOKBACK:

        raise ValueError(
            f"Not enough data for SHAP background. "
            f"Need at least {LOOKBACK} rows."
        )

    background_sequences = []

    # --------------------------------------------------------
    # Use recent historical sequences as SHAP background
    # --------------------------------------------------------

    start = max(
        0,
        len(scaled)
        - LOOKBACK
        - BACKGROUND_SIZE
    )

    end = (
        len(scaled)
        - LOOKBACK
    )

    for i in range(
        start,
        end
    ):

        sequence = scaled[
            i:i + LOOKBACK
        ]

        if len(sequence) == LOOKBACK:

            background_sequences.append(
                sequence
            )

    # --------------------------------------------------------
    # Fallback
    # --------------------------------------------------------

    if not background_sequences:

        background_sequences = [
            scaled[-LOOKBACK:]
        ]

    background = np.asarray(
        background_sequences,
        dtype=np.float32
    )

    # Keep background size controlled
    if len(background) > BACKGROUND_SIZE:

        background = background[
            -BACKGROUND_SIZE:
        ]

    return background


# ============================================================
# CORE SHAP EXPLANATION
# ============================================================

def explain_sequence(
    X_target,
    raw_values,
    date_value="Manual input"
):

    model = load_model()

    # --------------------------------------------------------
    # Validate target sequence
    # --------------------------------------------------------

    X_target = np.asarray(
        X_target,
        dtype=np.float32
    )

    expected_input_shape = (
        1,
        LOOKBACK,
        len(FEATURES)
    )

    if X_target.shape != expected_input_shape:

        raise ValueError(
            "Invalid SHAP input shape. "
            f"Expected {expected_input_shape}, "
            f"got {X_target.shape}"
        )

    # --------------------------------------------------------
    # Get current prediction
    # --------------------------------------------------------

    prediction_result = model.predict(
        X_target,
        verbose=0
    )

    prediction = float(
        np.asarray(
            prediction_result
        ).reshape(-1)[0]
    )

    # --------------------------------------------------------
    # Generate current signal
    # --------------------------------------------------------

    signal_data = generate_signal(
        prediction
    )

    # --------------------------------------------------------
    # Background data
    # --------------------------------------------------------

    background = get_background_sequences()

    # --------------------------------------------------------
    # Calculate SHAP
    # --------------------------------------------------------

    explainer_name = "GradientExplainer"

    try:

        explainer = shap.GradientExplainer(
            model,
            background
        )

        shap_values = explainer.shap_values(
            X_target
        )

    except Exception as gradient_error:

        print(
            "\nGradientExplainer failed:"
        )

        print(
            gradient_error
        )

        print(
            "Trying DeepExplainer..."
        )

        explainer_name = "DeepExplainer"

        try:

            explainer = shap.DeepExplainer(
                model,
                background
            )

            shap_values = explainer.shap_values(
                X_target
            )

        except Exception as deep_error:

            print(
                "\nDeepExplainer failed:"
            )

            print(
                deep_error
            )

            raise RuntimeError(
                "Unable to calculate SHAP explanation. "
                "Both GradientExplainer and DeepExplainer failed.\n\n"
                f"GradientExplainer error:\n"
                f"{gradient_error}\n\n"
                f"DeepExplainer error:\n"
                f"{deep_error}"
            )

    # --------------------------------------------------------
    # Normalize SHAP output
    # --------------------------------------------------------

    shap_values = prepare_shap_array(
        shap_values
    )

    expected_shape = (
        1,
        LOOKBACK,
        len(FEATURES)
    )

    if shap_values.shape != expected_shape:

        raise RuntimeError(
            "SHAP shape mismatch.\n"
            f"Expected: {expected_shape}\n"
            f"Received: {shap_values.shape}"
        )

    # --------------------------------------------------------
    # Aggregate 30 timesteps into 7 features
    # --------------------------------------------------------

    # Absolute SHAP importance
    feature_importance = np.mean(
        np.abs(
            shap_values[0]
        ),
        axis=0
    )

    # Signed contribution
    feature_contribution = np.mean(
        shap_values[0],
        axis=0
    )

    # --------------------------------------------------------
    # Build feature explanation
    # --------------------------------------------------------

    explanation = []

    for i, feature in enumerate(
        FEATURES
    ):

        importance = float(
            feature_importance[i]
        )

        contribution = float(
            feature_contribution[i]
        )

        # ----------------------------------------------------
        # Contribution direction
        # ----------------------------------------------------

        if contribution > 0:

            direction = "Positive"

        elif contribution < 0:

            direction = "Negative"

        else:

            direction = "Neutral"

        # ----------------------------------------------------
        # Current raw feature value
        # ----------------------------------------------------

        value = raw_values.get(
            feature
        )

        if value is not None:

            try:

                value = float(value)

            except Exception:

                value = None

        explanation.append({

            "feature": feature,

            "importance": importance,

            "contribution": contribution,

            "direction": direction,

            "value": value

        })

    # --------------------------------------------------------
    # Highest importance first
    # --------------------------------------------------------

    explanation.sort(
        key=lambda item:
            item["importance"],
        reverse=True
    )

    # --------------------------------------------------------
    # Final response
    # --------------------------------------------------------

    return {

        "success": True,

        "date": date_value,

        "prediction": round(
            prediction,
            4
        ),

        "signal":
            signal_data["signal"],

        "strategy":
            signal_data["strategy"],

        "rationale":
            signal_data["rationale"],

        "lookback":
            LOOKBACK,

        "explainer":
            explainer_name,

        "feature_count":
            len(FEATURES),

        "features":
            FEATURES,

        "explanation":
            explanation
    }


# ============================================================
# LATEST PREDICTION XAI
# ============================================================

def explain_latest_prediction():

    df = load_prediction_data()

    scaled = get_scaled_features()

    if len(scaled) < LOOKBACK:

        raise ValueError(
            f"Not enough data for XAI. "
            f"Need at least {LOOKBACK} rows."
        )

    # --------------------------------------------------------
    # Latest 30-row sequence
    # --------------------------------------------------------

    X_latest = np.expand_dims(
        scaled[-LOOKBACK:],
        axis=0
    ).astype(
        np.float32
    )

    # --------------------------------------------------------
    # Latest raw values
    # --------------------------------------------------------

    latest_row = df.iloc[-1]

    raw_values = {

        feature: float(
            latest_row[feature]
        )

        for feature in FEATURES

    }

    # --------------------------------------------------------
    # Date
    # --------------------------------------------------------

    date_value = "Latest available"

    if (
        "TIMESTAMP_PARSED" in df.columns
        and
        pd.notna(
            latest_row["TIMESTAMP_PARSED"]
        )
    ):

        date_value = (
            latest_row[
                "TIMESTAMP_PARSED"
            ]
            .strftime(
                "%Y-%m-%d"
            )
        )

    # --------------------------------------------------------
    # Generate explanation
    # --------------------------------------------------------

    return explain_sequence(
        X_latest,
        raw_values,
        date_value
    )


# ============================================================
# CUSTOM INPUT XAI
# ============================================================

def explain_custom_prediction(
    user_data
):

    # --------------------------------------------------------
    # Prepare the exact same sequence used by prediction
    #
    # 29 historical rows
    # +
    # 1 user row
    # =
    # 30 timesteps
    # --------------------------------------------------------

    X_custom = prepare_custom_sequence(
        user_data
    )

    # --------------------------------------------------------
    # Raw values of the NEW user input
    # --------------------------------------------------------

    raw_values = {

        feature: float(
            user_data[feature]
        )

        for feature in FEATURES

    }

    # --------------------------------------------------------
    # SHAP explanation for CURRENT user prediction
    # --------------------------------------------------------

    return explain_sequence(
        X_custom,
        raw_values,
        "Manual input"
    )