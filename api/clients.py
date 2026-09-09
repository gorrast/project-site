import os
from typing import Optional

from supabase import Client, create_client

_anon_client: Optional[Client] = None
_admin_client: Optional[Client] = None


def anon_client() -> Client:
    global _anon_client
    if _anon_client is None:
        _anon_client = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
        )
    return _anon_client


def admin_client() -> Client:
    global _admin_client
    if _admin_client is None:
        _admin_client = create_client(
            os.environ["NEXT_PUBLIC_SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )
    return _admin_client
