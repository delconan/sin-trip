export type ActivityCategory = "attraction" | "food" | "shopping" | "rest" | "transport";
export type PriceKind = "exact" | "from" | "range" | "free";
export type PriceSource = "klook" | "official" | "manual";

export interface PriceQuote {
  currency: "SGD";
  adult?: number;
  child?: number;
  familyTotal?: number;
  kind: PriceKind;
  source: PriceSource;
  sourceUrl?: string;
  checkedAt: string;
  note?: string;
}

export interface OpeningWindow {
  start: string;
  end: string;
}

export interface ActivityCard {
  id: string;
  title: string;
  subtitle?: string;
  category: ActivityCategory;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  durationMinutes: number;
  openingHours?: Record<string, OpeningWindow[]>;
  price?: PriceQuote;
  imageUrl?: string;
  imageCredit?: string;
  imageSourceUrl?: string;
  bookingUrl?: string;
  constraints?: string[];
  tags: string[];
  accent?: "leaf" | "sun" | "chilli" | "sky" | "night";
  custom?: boolean;
}

export interface ScheduledItem {
  id: string;
  cardId: string;
  date: string;
  startTime: string;
  position: number;
  notes?: string;
  version?: number;
}

export type RouteMode = "walk" | "transit" | "taxi";

export interface RouteOption {
  mode: RouteMode;
  durationMinutes: number;
  distanceMeters: number;
  summary: string;
  recommended: boolean;
  mapsUrl: string;
  cachedAt?: string;
}

export interface TripState {
  revision: number;
  cards: ActivityCard[];
  scheduledItems: ScheduledItem[];
}

