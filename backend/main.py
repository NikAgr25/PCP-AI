# ============================================================
# PCP AI - PUT-CALL PARITY ARBITRAGE INTELLIGENCE
# FASTAPI BACKEND
# ============================================================

import os

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session


# ============================================================
# DATABASE
# ============================================================

from database import (
    create_tables,
    get_db,
    User
)


# ============================================================
# AUTHENTICATION
# ============================================================

from auth import (
    hash_password,
    verify_password,
    create_token
)


# ============================================================
# PREDICTOR
# ============================================================

from predictor import (
    get_latest_signal,
    get_deviation_data,
    get_model_info,
    get_simulation_data,
    get_custom_prediction
)


# ============================================================
# XAI
# ============================================================

from xai import (
    explain_latest_prediction,
    explain_custom_prediction
)


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="PCP AI",
    description="Put-Call Parity Arbitrage Intelligence",
    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================
# DATABASE INITIALIZATION
# ============================================================

create_tables()


# ============================================================
# PROJECT PATHS
# ============================================================

# Project structure:
#
# pcp website/
# ├── backend/
# │   ├── main.py
# │   ├── auth.py
# │   ├── database.py
# │   ├── predictor.py
# │   └── xai.py
# │
# └── frontend/
#     ├── login.html
#     ├── dashboard.html
#     ├── CSS/
#     │   └── style.css
#     └── JS/
#         ├── auth.js
#         └── dashboard.js
#
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

PROJECT_DIR = os.path.dirname(
    BASE_DIR
)

FRONTEND_DIR = os.path.join(
    PROJECT_DIR,
    "frontend"
)

CSS_DIR = os.path.join(
    FRONTEND_DIR,
    "CSS"
)

JS_DIR = os.path.join(
    FRONTEND_DIR,
    "JS"
)


# ============================================================
# PATH CHECK
# ============================================================

print()
print("=" * 60)
print("PCP AI PATH CHECK")
print("=" * 60)

print("Backend:")
print(BASE_DIR)

print()

print("Project:")
print(PROJECT_DIR)

print()

print("Frontend:")
print(FRONTEND_DIR)

print()

print("CSS:")
print(CSS_DIR)

print()

print("JavaScript:")
print(JS_DIR)

print()

print("Frontend exists:")
print(os.path.isdir(FRONTEND_DIR))

print()

print("CSS exists:")
print(os.path.isfile(
    os.path.join(CSS_DIR, "style.css")
))

print()

print("Auth JS exists:")
print(os.path.isfile(
    os.path.join(JS_DIR, "auth.js")
))

print()

print("Dashboard JS exists:")
print(os.path.isfile(
    os.path.join(JS_DIR, "dashboard.js")
))

print()

print("Login HTML exists:")
print(os.path.isfile(
    os.path.join(FRONTEND_DIR, "login.html")
))

print()

print("Dashboard HTML exists:")
print(os.path.isfile(
    os.path.join(FRONTEND_DIR, "dashboard.html")
))

print("=" * 60)
print()


# ============================================================
# STATIC FILES
# ============================================================

# Main CSS path:
# /static/css/style.css
#
# Main JS paths:
# /static/js/auth.js
# /static/js/dashboard.js
#
# Additional compatibility:
# /static/style.css
#
# This prevents problems if one of the HTML files still uses
# the older /static/style.css path.
# ============================================================


# CSS folder
if os.path.isdir(CSS_DIR):

    app.mount(
        "/static/css",
        StaticFiles(
            directory=CSS_DIR
        ),
        name="css"
    )

else:

    print(
        "WARNING: CSS directory not found:",
        CSS_DIR
    )


# JavaScript folder
if os.path.isdir(JS_DIR):

    app.mount(
        "/static/js",
        StaticFiles(
            directory=JS_DIR
        ),
        name="js"
    )

else:

    print(
        "WARNING: JS directory not found:",
        JS_DIR
    )


# ============================================================
# COMPATIBILITY CSS ROUTE
# ============================================================

@app.get("/static/style.css")
def legacy_css():

    css_file = os.path.join(
        CSS_DIR,
        "style.css"
    )

    if not os.path.isfile(css_file):

        raise HTTPException(
            status_code=404,
            detail="style.css not found"
        )

    return FileResponse(
        css_file,
        media_type="text/css"
    )


# ============================================================
# REQUEST MODELS
# ============================================================

class RegisterRequest(BaseModel):

    email: EmailStr

    password: str


class LoginRequest(BaseModel):

    email: EmailStr

    password: str


class PredictionRequest(BaseModel):

    spot_price: float = Field(
        ...,
        ge=0
    )

    strike_price: float = Field(
        ...,
        ge=0
    )

    call_price: float = Field(
        ...,
        ge=0
    )

    put_price: float = Field(
        ...,
        ge=0
    )

    call_open_interest: float = Field(
        ...,
        ge=0
    )

    put_open_interest: float = Field(
        ...,
        ge=0
    )

    time_to_expiry: float = Field(
        ...,
        ge=0
    )


# ============================================================
# REQUEST → MODEL DATA
# ============================================================

def request_to_model_data(
    request: PredictionRequest
):

    return {

        "SpotPrice_CE":
            request.spot_price,

        "STRIKE_PR":
            request.strike_price,

        "CLOSE_CE":
            request.call_price,

        "CLOSE_PE":
            request.put_price,

        "OPEN_INT_CE":
            request.call_open_interest,

        "OPEN_INT_PE":
            request.put_open_interest,

        "T":
            request.time_to_expiry

    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/api/health")
def health_check():

    return {

        "success": True,

        "status": "ok",

        "message":
            "PCP AI backend is running"

    }


# ============================================================
# REGISTER
# ============================================================

@app.post("/api/register")
def register(
    request: RegisterRequest,
    db: Session = Depends(get_db)
):

    existing_user = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail=(
                "An account with this "
                "email already exists."
            )
        )

    if len(request.password) < 6:

        raise HTTPException(
            status_code=400,
            detail=(
                "Password must contain "
                "at least 6 characters."
            )
        )

    hashed_password = hash_password(
        request.password
    )

    new_user = User(
        email=request.email,
        password=hashed_password
    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

    return {

        "success": True,

        "message":
            "Account created successfully."

    }


# ============================================================
# LOGIN
# ============================================================

@app.post("/api/login")
def login(
    request: LoginRequest,
    db: Session = Depends(get_db)
):

    user = (
        db.query(User)
        .filter(
            User.email == request.email
        )
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    password_valid = verify_password(
        request.password,
        user.password
    )

    if not password_valid:

        raise HTTPException(
            status_code=401,
            detail="Invalid email or password."
        )

    token = create_token(
        user.email
    )

    return {

        "success": True,

        "message":
            "Login successful.",

        "token":
            token,

        "access_token":
            token,

        "email":
            user.email,

        "token_type":
            "bearer"

    }


# ============================================================
# LATEST SIGNAL
# ============================================================

@app.get("/api/signal")
def signal():

    try:

        result = get_latest_signal()

        return result

    except Exception as e:

        print(
            "Signal error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# CUSTOM PREDICTION
# ============================================================

@app.post("/api/predict")
def manual_prediction(
    request: PredictionRequest
):

    try:

        model_data = request_to_model_data(
            request
        )

        result = get_custom_prediction(
            model_data
        )

        return result

    except ValueError as e:

        print(
            "Prediction validation error:",
            str(e)
        )

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        print(
            "Prediction failed:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Prediction failed: "
                + str(e)
            )
        )


# ============================================================
# LATEST XAI
# ============================================================

@app.get("/api/xai")
def latest_xai():

    try:

        result = explain_latest_prediction()

        return result

    except Exception as e:

        print(
            "XAI error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# CUSTOM XAI
# ============================================================

@app.post("/api/xai")
def custom_xai(
    request: PredictionRequest
):

    try:

        model_data = request_to_model_data(
            request
        )

        result = explain_custom_prediction(
            model_data
        )

        return result

    except ValueError as e:

        print(
            "XAI validation error:",
            str(e)
        )

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    except Exception as e:

        print(
            "Custom XAI failed:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "XAI explanation failed: "
                + str(e)
            )
        )


# ============================================================
# MODEL INFORMATION
# ============================================================

@app.get("/api/model-info")
def model_info():

    try:

        result = get_model_info()

        return result

    except Exception as e:

        print(
            "Model info error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# PCP DEVIATION DATA
# ============================================================

@app.get("/api/deviation")
def deviation(
    days: int = 60
):

    try:

        # Prevent invalid or unnecessarily large requests
        days = max(
            1,
            min(days, 365)
        )

        result = get_deviation_data(
            days
        )

        return result

    except Exception as e:

        print(
            "Deviation error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# HISTORICAL SIMULATION API
# ============================================================
#
# Backend endpoint retained for compatibility.
#
# The Historical Simulation UI will NOT be shown in the new
# dashboard.
#
# ============================================================

@app.get("/api/simulation")
def simulation(
    points: int = 60
):

    try:

        points = max(
            1,
            min(points, 365)
        )

        result = get_simulation_data(
            points
        )

        return result

    except Exception as e:

        print(
            "Simulation error:",
            str(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


# ============================================================
# LOGIN PAGE
# ============================================================

@app.get("/")
def login_page():

    login_file = os.path.join(
        FRONTEND_DIR,
        "login.html"
    )

    if not os.path.isfile(login_file):

        raise HTTPException(
            status_code=404,
            detail=(
                "login.html not found: "
                + login_file
            )
        )

    return FileResponse(
        login_file,
        media_type="text/html"
    )


# ============================================================
# DASHBOARD PAGE
# ============================================================

@app.get("/dashboard")
def dashboard_page():

    dashboard_file = os.path.join(
        FRONTEND_DIR,
        "dashboard.html"
    )

    if not os.path.isfile(
        dashboard_file
    ):

        raise HTTPException(
            status_code=404,
            detail=(
                "dashboard.html not found: "
                + dashboard_file
            )
        )

    return FileResponse(
        dashboard_file,
        media_type="text/html"
    )


# ============================================================
# FAVICON
# ============================================================

@app.get("/favicon.ico")
def favicon():

    favicon_file = os.path.join(
        FRONTEND_DIR,
        "favicon.ico"
    )

    if os.path.isfile(
        favicon_file
    ):

        return FileResponse(
            favicon_file,
            media_type="image/x-icon"
        )

    raise HTTPException(
        status_code=404,
        detail="favicon.ico not found"
    )


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )