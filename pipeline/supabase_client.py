import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_file(PROJECT_ROOT / ".env.local")
load_env_file(PROJECT_ROOT / ".env")

from supabase import Client, create_client

_admin_client: Client | None = None


def admin_client() -> Client:
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _admin_client


def upsert_in_batches(client: Client, table: str, rows: list[dict], batch_size: int = 500) -> None:
    for i in range(0, len(rows), batch_size):
        client.schema("fpl").table(table).upsert(rows[i : i + batch_size]).execute()
