"""Experiment dataclass + store helpers."""
import json, time, uuid
from dataclasses import dataclass, field, asdict
from typing import Optional
from environnets.core.models import Store, Network


@dataclass
class Experiment:
    exp_id: str
    name: str
    description: str = ""
    network_id: str = ""
    parameters: dict = field(default_factory=dict)
    status: str = "draft"
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None


def migrate_experiments(store: Store):
    c = store._conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS experiments (
            exp_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            network_id TEXT DEFAULT '',
            parameters TEXT DEFAULT '{}',
            status TEXT DEFAULT 'draft',
            created_at REAL NOT NULL,
            started_at REAL
        )
    """)
    store._conn.commit()


def save_experiment(store: Store, e: Experiment):
    migrate_experiments(store)
    store._conn.execute(
        "INSERT OR REPLACE INTO experiments (exp_id,name,description,network_id,parameters,status,created_at,started_at) VALUES (?,?,?,?,?,?,?,?)",
        (e.exp_id, e.name, e.description, e.network_id, json.dumps(e.parameters), e.status, e.created_at, e.started_at),
    )
    store._conn.commit()


def list_experiments(store: Store) -> list[dict]:
    migrate_experiments(store)
    return [dict(r) for r in store._conn.execute(
        "SELECT exp_id,name,description,network_id,status,created_at FROM experiments ORDER BY created_at DESC"
    ).fetchall()]


def load_experiment(store: Store, exp_id: str) -> Optional[Experiment]:
    migrate_experiments(store)
    row = store._conn.execute("SELECT * FROM experiments WHERE exp_id=?", (exp_id,)).fetchone()
    if not row:
        return None
    return Experiment(
        exp_id=row["exp_id"], name=row["name"], description=row["description"],
        network_id=row["network_id"], parameters=json.loads(row["parameters"] or "{}"),
        status=row["status"], created_at=row["created_at"], started_at=row["started_at"],
    )


def delete_experiment(store: Store, exp_id: str):
    migrate_experiments(store)
    store._conn.execute("DELETE FROM experiments WHERE exp_id=?", (exp_id,))
    store._conn.commit()
