# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Primary users: Urban diners and office workers experiencing daily meal decision fatigue ("Hôm nay ăn gì?"), seeking instant mood-based dish discovery, roulette picking, and AI recommendations.
- Secondary audience: Foodies and local diners who read and contribute community reviews, dishes, and ratings.

## Product Purpose
Fooday eliminates meal indecision by providing an engaging, high-speed discovery interface that turns the mundane chore of choosing a meal into an effortless, playful experience. Success means users find an appealing meal in under 60 seconds—whether through intuitive mood/craving filters, a CS:GO-style roulette spinner, grounded AI chat, or community reviews.

## Positioning
Decision-first food discovery paired with lightweight community validation. Unlike bloated delivery apps optimized for checkout friction or generic review portals buried in ad rankings, Fooday combines mood-driven filters, an interactive roulette picker, grounded AI meal assistance, and YouTube-style community comments into a focused, delightful web app.

## Operating Context
- Environments: Mobile smartphones (primary, on-the-go or during lunch breaks) and desktop web browsers (office work, planning meals).
- Physical & social contexts: Office workers deciding lunch in groups or alone, evening diners looking for cravings/places, quick snack searches.
- Languages: Vietnamese (primary default) and English, supporting full i18n localization.

## Capabilities and Constraints
- Confirmed capabilities:
  - Mood/Task-based category filtering (Ăn no, Nhanh gọn, Healthy, Ăn vặt, Tráng miệng, Thử thách).
  - Multi-field accent-insensitive smart search (dishes, restaurants, tags, addresses).
  - CS:GO-style case opening roulette for instant randomized food picks with sound/haptics.
  - Grounded AI Chatbot for conversational food recommendations.
  - Real-time Supabase Favorites sync and Supabase Auth (Email + Guest mode).
  - Interactive Dish Detail Modal with directions, Google Maps linking, price tier, and YouTube-style comments/reviews.
  - Full Vietnamese & English i18n support.
- Technical constraints:
  - Next.js 16 App Router + React 19 + TypeScript.
  - Pure native `styled-jsx` with centralized CSS variables in `globals.css` (no Tailwind, no utility CSS classes).
  - Mobile-first `.app-shell` responsive container (max 480px on mobile, expands on desktop with sidebar).
  - FastAPI backend (`fooday_backend`) for AI inference over HTTPS.

## Brand Commitments
- Name: Fooday (🍱)
- Voice & Tone: Playful, appetizing, decisive, and empathetic to the universal pain of "Hôm nay ăn gì?".
- Personality: Clean, vibrant, modern, high-craft, and responsive without bloat.

## Evidence on Hand
- Dish catalog and real-world dishes located in `fooday_frontend/src/hooks/useFoods.ts` and Supabase `foods` table.
- Task archive documenting all audited features in `docs/tasks/`.
- Working localized strings in `fooday_frontend/src/i18n/translations.ts`.
- Absence note: No direct food delivery logistics or checkout payment processing; external links open Google Maps for directions.

## Product Principles
1. **Decision Over Infinite Browsing**: Guide the user to a decisive choice in seconds; reduce cognitive friction over endless list scrolling.
2. **Playful & Tactile Micro-Interactions**: Features like the roulette wheel and fluid spring modals transform mundane choices into engaging moments.
3. **Zero-Latency Feel**: Instant local filtering, accent-insensitive search, and optimistic state updates before network round-trips.
4. **App-Shell Integrity**: Treat the web application as a native-grade mobile experience with fluid touch targets (min 44px) and adaptive layouts.
5. **Grounded Authenticity**: Recommendations and reviews reflect real dishes, genuine local tastes, and accurate pricing tiers.

## Accessibility & Inclusion
- Minimum 44x44px touch targets enforced across all interactive elements.
- Fluid typography using `clamp()` to maintain legibility without layout breaks across zoom and viewport sizes.
- Contrast compliance with both Dark and Light theme palettes.
- Keyboard navigability for modals and search inputs.
