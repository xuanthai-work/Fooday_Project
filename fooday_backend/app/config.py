"""Loads env and initializes the Supabase client (shared, module-level)."""
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client, Client

# Load fooday_backend/.env regardless of the current working directory.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
OPENCODE_API_KEY = os.getenv("OPENCODE_API_KEY")
OPENCODE_BASE_URL = os.getenv("OPENCODE_BASE_URL", "https://opencode.ai/zen/go/v1")
OPENCODE_MODEL = os.getenv("OPENCODE_MODEL", "minimax-m3.1-flash-free")
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
INTERNAL_API_SECRET = os.getenv("INTERNAL_API_SECRET")

supabase: Client | None = (
    create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    if SUPABASE_URL and SUPABASE_ANON_KEY
    else None
)
