export type FoodCategory = 'Foods' | 'Drinks' | 'Snacks';

export interface FoodItem {
  name: string;
  category: FoodCategory;
  restaurant: string;
  rating: number;
  image: string;
  tag?: string;
}

const img = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=600&q=80`;

export const FOODS: FoodItem[] = [
  {
    name: 'Spicy Beef Ramen',
    category: 'Foods',
    restaurant: 'Noodle House',
    rating: 4.8,
    image: img('1569718212165-3a8278d5f624'),
    tag: 'Trending',
  },
  {
    name: 'Classic Beef Burger',
    category: 'Foods',
    restaurant: 'Burger Lab',
    rating: 4.7,
    image: img('1568901346375-23c9450c58cd'),
  },
  {
    name: 'Crispy Fried Chicken',
    category: 'Foods',
    restaurant: 'Seoul Chicken',
    rating: 4.9,
    image: img('1626082927389-6cd097cdc6ec'),
    tag: 'Top rated',
  },
  {
    name: 'Rainbow Poke Bowl',
    category: 'Foods',
    restaurant: 'Green Life',
    rating: 4.6,
    image: img('1546069901-ba9599a7e63c'),
    tag: 'Healthy',
  },
  {
    name: 'Wood-Fired Pizza',
    category: 'Foods',
    restaurant: 'Bella Forno',
    rating: 4.8,
    image: img('1513104890138-7c749659a591'),
  },
  {
    name: 'Salmon Sushi Platter',
    category: 'Foods',
    restaurant: 'Sakana',
    rating: 4.7,
    image: img('1579871494447-9811cf80d66c'),
  },
  {
    name: 'Garden Buddha Bowl',
    category: 'Foods',
    restaurant: 'Green Life',
    rating: 4.5,
    image: img('1512621776951-a57141f2eefd'),
    tag: 'Healthy',
  },
  {
    name: 'Grilled Herb Plate',
    category: 'Foods',
    restaurant: 'Ocean Grill',
    rating: 4.6,
    image: img('1555939594-58d7cb561ad1'),
  },
  {
    name: 'Iced Matcha Latte',
    category: 'Drinks',
    restaurant: 'Matcha & Co.',
    rating: 4.7,
    image: img('1536256263959-770b48d82b0a'),
    tag: 'Trending',
  },
  {
    name: 'Mixed Berry Smoothie',
    category: 'Drinks',
    restaurant: 'Smoothie Bar',
    rating: 4.5,
    image: img('1553530666-ba11a7da3888'),
  },
  {
    name: 'Fresh Orange Juice',
    category: 'Drinks',
    restaurant: 'Smoothie Bar',
    rating: 4.4,
    image: img('1600271886742-f049cd451bba'),
  },
  {
    name: 'Caramel Latte',
    category: 'Drinks',
    restaurant: 'Brew Haus',
    rating: 4.6,
    image: img('1509042239860-f550ce710b93'),
  },
  {
    name: 'Choco Chip Cookies',
    category: 'Snacks',
    restaurant: 'Sweet Bakery',
    rating: 4.9,
    image: img('1499636136210-6f4ee915583e'),
    tag: 'Sweet',
  },
  {
    name: 'Glazed Donuts',
    category: 'Snacks',
    restaurant: 'Sweet Bakery',
    rating: 4.7,
    image: img('1551024601-bec78aea704b'),
    tag: 'Sweet',
  },
];

export const FOOD_BY_NAME: Record<string, FoodItem> = Object.fromEntries(
  FOODS.map((f) => [f.name, f]),
);
