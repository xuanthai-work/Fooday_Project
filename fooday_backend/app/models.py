from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single turn of the conversation, sent back by the client.

    The frontend keeps the last few turns in memory so the model can follow
    references such as "not fried rice today" without repeating itself.
    """

    role: str  # "user" | "assistant"
    content: str


class UserCoords(BaseModel):
    """GPS position of the user, used to rank restaurants by distance."""

    lat: float
    lng: float


class DishCardInfo(BaseModel):
    """A dish rendered as a rich card inside the chat bubble."""

    id: int
    name: str
    restaurant: str
    rating: float
    image_url: str
    distance_km: float | None = None
    address: str | None = None


class ChatRequest(BaseModel):
    """Payload sent by the frontend chat client."""

    user_message: str
    user_id: str | None = "guest"
    favorites: list[str] | None = None  # dish names the user has favorited, for personalization
    language: str | None = "vi"  # active UI language, "vi" | "en"
    conversation_history: list[ChatMessage] | None = None  # last turns, for multi-turn context
    user_coords: UserCoords | None = None  # GPS position, for location-aware answers


class ChatResponse(BaseModel):
    """Recommendation returned to the frontend chat client."""

    reply: str
    action: str | None = None  # optional follow-up action, e.g. "open_map"
    suggested_dishes: list[str] = Field(default_factory=list)
    suggested_cards: list[DishCardInfo] = Field(default_factory=list)
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
    place_id: str | None = None
