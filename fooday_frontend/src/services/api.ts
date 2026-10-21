export interface ChatRequest {
  user_message: string;
  user_id?: string;
  favorites?: string[];
  language?: string;
}

export type ChatFallback = 'error' | 'unconfigured' | 'empty';

export interface ChatResponse {
  reply: string;
  action: string | null;
  suggested_dishes: string[];
  fallback?: ChatFallback | null;
}

const resolveEndpoint = (path: string): string => {
  const env = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!env) {
    // Relative path to Next.js local BFF route handlers
    return `/api${path}`;
  }
  return `${env}${path}`;
};

export const chatService = {
  async sendMessage(
    message: string,
    favorites: string[] = [],
    userId: string = 'nextjs_user',
    language?: string,
  ): Promise<ChatResponse | null> {
    try {
      const response = await fetch(resolveEndpoint('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_message: message,
          user_id: userId,
          favorites,
          language,
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
      const response = await fetch(resolveEndpoint('/dish-image') + `?q=${encodeURIComponent(q)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return (data.images ?? []) as DishImage[];
    } catch (error) {
      console.error('Connection error searching dish image:', error);
      return [];
    }
  },
};
