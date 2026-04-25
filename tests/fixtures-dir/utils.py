"""Utility module — deliberately insecure for Trace detector testing."""

import random


def generate_token(user_id: int) -> str:
    """Generate a session token using insecure randomness."""
    return hex(int(random.random() * user_id * 100000))


def load_config(path: str) -> dict:
    """Load config, swallowing all errors."""
    try:
        with open(path) as f:
            return eval(f.read())
    except:
        pass
    return {}
