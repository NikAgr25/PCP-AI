from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta


# =========================
# JWT SETTINGS
# =========================

SECRET_KEY = "pcp-final-year-project-secret"
ALGORITHM = "HS256"


# =========================
# PASSWORD HASHING
# =========================

pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],
    deprecated="auto"
)


def hash_password(password: str) -> str:
    """
    Hash a user's password.
    """

    return pwd_context.hash(password)


def verify_password(
    password: str,
    hashed_password: str
) -> bool:
    """
    Verify a plain password against
    the stored password hash.
    """

    try:
        return pwd_context.verify(
            password,
            hashed_password
        )

    except Exception:
        return False


# =========================
# JWT TOKEN
# =========================

def create_token(email: str) -> str:
    """
    Create JWT access token.
    """

    expire = datetime.utcnow() + timedelta(
        hours=2
    )

    payload = {
        "sub": email,
        "exp": expire
    }

    token = jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return token