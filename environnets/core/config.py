"""Config loader.

Reads config.json from the project root and provides defaults.
"""

import json
import os
from pathlib import Path

_CONFIG = None
_CONFIG_PATH = Path(__file__).parent.parent / "config.json"


def _load():
    global _CONFIG
    if _CONFIG is not None:
        return _CONFIG
    try:
        with open(_CONFIG_PATH) as f:
            _CONFIG = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        _CONFIG = {}
    return _CONFIG


def get(section: str, key: str, default=None):
    """Get a config value. Example: get('connection', 'default_url')"""
    cfg = _load()
    return cfg.get(section, {}).get(key, default)


def get_section(section: str) -> dict:
    """Get an entire config section."""
    cfg = _load()
    return cfg.get(section, {})


def set_value(section: str, key: str, value):
    """Update a config value and write back to disk."""
    cfg = _load()
    if section not in cfg:
        cfg[section] = {}
    cfg[section][key] = value
    try:
        with open(_CONFIG_PATH, "w") as f:
            json.dump(cfg, f, indent=2)
    except OSError:
        pass
