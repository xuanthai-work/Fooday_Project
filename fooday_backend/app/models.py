from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Payload sent by the frontend chat client."""

    user_message: str
    user_id: str | None = "guest"
    favorites: list[str] | None = None  # dish names the user has favorited, for personalization
    language: str | None = None  # active UI language, "vi" | "en"


class ChatResponse(BaseModel):
    """Recommendation returned to the frontend chat client."""

    reply: str
    action: str | None = None  # optional follow-up action, e.g. "open_map"
    suggested_dishes: list[str] = Field(default_factory=list)
    # Set when reply is a system fallback so the client can localize it.
    # "error" | "unconfigured" | "empty"
    fallback: str | None = None


class ParseMapResponse(BaseModel):
    """Metadata extracted from a pasted Google Maps link.

    Every field is optional: when a link cannot be resolved the endpoint still
    answers with HTTP 200 and all-null fields so the client never crashes.
    """

    restaurant_name: str | None = None
    address: str | None = None
    resolved_url: str | None = None
