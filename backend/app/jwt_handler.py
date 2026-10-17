import os
from jose import jwt, JWTError
from datetime import datetime, timedelta

# Read from environment — falls back to a default only in local dev
SECRET_KEY = os.getenv("SECRET_KEY", "mysecretkey-change-me-in-production")
ALGORITHM  = "HS256"

# 7 days — long enough that users are not silently logged out mid-session
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
