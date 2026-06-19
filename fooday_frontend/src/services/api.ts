export interface ChatRequest {
  user_message: string;
  user_id?: string;
  favorites?: string[];
}

export interface ChatResponse {
  reply: string;
  action: string | null;
  suggested_dishes: string[];
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:2001/api/v1';

export const chatService = {
  async sendMessage(
    message: string,
    favorites: string[] = [],
    userId: string = 'nextjs_user',
  ): Promise<ChatResponse | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: message,
          user_id: userId,
          favorites,
        } as ChatRequest),
      });

      if (!response.ok) {
        console.error(`API Error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      return data as ChatResponse;
    } catch (error) {
      console.error('Connection error sending message:', error);
      return null;
    }
  }
};

export interface DishImage {
  url: string;
  alt: string;
  credit: string;
}

export const dishImageService = {
  async search(q: string): Promise<DishImage[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/dish-image?q=${encodeURIComponent(q)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.images ?? []) as DishImage[];
    } catch (error) {
      console.error('Connection error searching dish image:', error);
      return [];
    }
  },
};
