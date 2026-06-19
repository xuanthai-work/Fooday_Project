from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """Payload sent by the frontend chat client."""

    user_message: str
    user_id: str | None = "guest"
    favorites: list[str] | None = None  # dish names the user has favorited, for personalization


class ChatResponse(BaseModel):
    """Recommendation returned to the frontend chat client."""

    reply: str
    action: str | None = None  # optional follow-up action, e.g. "open_map"
    suggested_dishes: list[str] = Field(default_factory=list)
