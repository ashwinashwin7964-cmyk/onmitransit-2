"""
OmniTransit JWT Authentication Module
====================================
Zero-dependency, cryptographically secure JWT (JSON Web Token) implementation
using HMAC-SHA256 (RFC 7519 compliant).

Provides:
- Token generation with roles, permissions, and expiration
- Token signature verification and tamper detection
- Default metropolitan operator credentials for the Coimbatore Smart City command center
"""

import base64
import hashlib
import hmac
import json
import time
from typing import Any, Dict, Optional, Tuple

SECRET_KEY = "OmniTransit-Coimbatore-SmartCity-SecretKey-2026-HMAC256"

# Pre-configured enterprise transit credentials
USERS_DB = {
    "admin": {
        "password": "omni2026",
        "name": "K. Senthil Kumar",
        "role": "Chief Transit Architect",
        "agency": "Coimbatore Metropolitan Transport Authority (CMTA)",
        "permissions": ["DISRUPT", "OPTIMIZE", "TRAIN_MODEL", "POLICY_OVERRIDE"],
    },
    "dispatcher": {
        "password": "coimbatore2026",
        "name": "P. Ramesh",
        "role": "Central Bus Dispatch Officer",
        "agency": "Gandhipuram Central Operations Control",
        "permissions": ["OPTIMIZE", "VIEW_TELEMETRY"],
    },
    "planner": {
        "password": "smartcity2026",
        "name": "Dr. Ananya Iyer",
        "role": "Urban Mobility Research Lead",
        "agency": "Coimbatore Smart City Planning Directorate",
        "permissions": ["TRAIN_MODEL", "ROBUST_MPC_AUDIT", "VIEW_TELEMETRY"],
    },
}


def _b64_encode(data: bytes) -> str:
    """URL-safe Base64 encoding without trailing padding."""
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64_decode(data_str: str) -> bytes:
    """URL-safe Base64 decoding with restored padding."""
    rem = len(data_str) % 4
    if rem > 0:
        data_str += "=" * (4 - rem)
    return base64.urlsafe_b64decode(data_str.encode("utf-8"))


class JWTAuth:
    """HMAC-SHA256 JWT Token Manager for OmniTransit Command Center."""

    @staticmethod
    def generate_token(username: str, expires_in_seconds: int = 86400) -> Optional[str]:
        """Generates a signed JWT token for a valid username."""
        user = USERS_DB.get(username)
        if not user:
            return None

        header = {"alg": "HS256", "typ": "JWT"}
        now = int(time.time())
        payload = {
            "sub": username,
            "name": user["name"],
            "role": user["role"],
            "agency": user["agency"],
            "permissions": user["permissions"],
            "iat": now,
            "exp": now + expires_in_seconds,
            "iss": "OmniTransit-Coimbatore-Auth-Authority",
        }

        h_b64 = _b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        p_b64 = _b64_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        message = f"{h_b64}.{p_b64}".encode("utf-8")

        signature = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        s_b64 = _b64_encode(signature)

        return f"{h_b64}.{p_b64}.{s_b64}"

    @staticmethod
    def verify_token(token_str: str) -> Tuple[bool, Dict[str, Any]]:
        """
        Validates JWT token signature and expiration.
        Returns (is_valid, payload_or_error_dict).
        """
        if not token_str or not isinstance(token_str, str):
            return False, {"error": "Token missing or malformed"}

        parts = token_str.strip().split(".")
        if len(parts) != 3:
            return False, {"error": "Invalid token segment structure"}

        h_b64, p_b64, s_b64 = parts
        message = f"{h_b64}.{p_b64}".encode("utf-8")

        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), message, hashlib.sha256).digest()
        expected_s_b64 = _b64_encode(expected_sig)

        if not hmac.compare_digest(s_b64, expected_s_b64):
            return False, {"error": "Token signature mismatch - authentication rejected"}

        try:
            payload = json.loads(_b64_decode(p_b64).decode("utf-8"))
        except Exception as e:
            return False, {"error": f"Failed to parse payload: {str(e)}"}

        now = int(time.time())
        if payload.get("exp", 0) < now:
            return False, {"error": "Token has expired - re-authentication required"}

        return True, payload

    @staticmethod
    def authenticate_credentials(username: str, password: str) -> Optional[Dict[str, Any]]:
        """Validates username/password and returns user info + JWT token."""
        user = USERS_DB.get(username)
        if user and user["password"] == password:
            token = JWTAuth.generate_token(username)
            return {
                "token": token,
                "username": username,
                "name": user["name"],
                "role": user["role"],
                "agency": user["agency"],
                "permissions": user["permissions"],
                "expires_in": 86400,
            }
        return None
