"""PIN hashing. Not a security boundary (spec §3.1), just enough not to store the digits."""
import hashlib, hmac, os

ITERATIONS = 50_000


def hash_pin(pin: str) -> str:
    salt = os.urandom(8).hex()
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_pin(pin: str, stored: str) -> bool:
    salt, digest = stored.split("$", 1)
    candidate = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), ITERATIONS).hex()
    return hmac.compare_digest(candidate, digest)
