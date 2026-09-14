import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from typing import Callable, Optional

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .clients import admin_client

SESSION_DURATION_MS = 24 * 60 * 60 * 1000


class LoginBody(BaseModel):
    username: str
    password: str


def get_secret() -> str:
    secret = os.environ.get("ADMIN_SESSION_SECRET")
    if not secret:
        raise RuntimeError("ADMIN_SESSION_SECRET is not set")
    return secret


def b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64url_decode(s: str) -> bytes:
    padding = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + padding)


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256((salt + password).encode()).hexdigest()


def sign_session_token(username: str) -> str:
    exp = int(time.time() * 1000) + SESSION_DURATION_MS
    payload = b64url_encode(json.dumps({"username": username, "exp": exp}, separators=(",", ":")).encode())
    sig = b64url_encode(hmac.new(get_secret().encode(), payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def verify_session_token(token: str) -> Optional[str]:
    try:
        dot_idx = token.rfind(".")
        if dot_idx == -1:
            return None
        payload = token[:dot_idx]
        sig = token[dot_idx + 1:]

        expected_sig = b64url_encode(hmac.new(get_secret().encode(), payload.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected_sig):
            return None

        data = json.loads(b64url_decode(payload))
        if time.time() * 1000 > data["exp"]:
            return None
        return data["username"]
    except Exception:
        return None


def require_admin_cookie(cookie_name: str) -> Callable[[Request], str]:
    """Factory for a FastAPI dependency that checks one specific session
    cookie. Each feature area gets its own cookie name so a session created
    by one feature's login can never authorize another's routes."""

    def _dependency(request: Request) -> str:
        token = request.cookies.get(cookie_name)
        if not token:
            raise HTTPException(status_code=401, detail="Unauthorized")
        username = verify_session_token(token)
        if not username:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        return username

    return _dependency


def authenticate_admin(username: str, password: str) -> bool:
    """Looks up admin_credentials by exact username and constant-time
    compares the salted hash. Hashes a dummy value on a missing user so a
    lookup miss and a wrong password take the same time."""
    client = admin_client()
    try:
        result = (
            client.table("admin_credentials")
            .select("username, password_hash, salt")
            .eq("username", username)
            .single()
            .execute()
        )
        data = result.data
    except Exception:
        data = None

    if not data:
        hash_password(password, secrets.token_hex(16))
        return False

    input_hash = hash_password(password, data["salt"])
    return hmac.compare_digest(input_hash, data["password_hash"])


def set_admin_cookie(response: JSONResponse, cookie_name: str, username: str) -> None:
    token = sign_session_token(username)
    response.set_cookie(
        cookie_name,
        token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=24 * 60 * 60,
        path="/",
    )
