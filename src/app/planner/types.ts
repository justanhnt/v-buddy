export type Mode = "route" | "trip" | "eat" | "fuel" | "charge" | "parking" | "insurance";

export type PlaceCategory = "eat" | "fuel" | "charge" | "parking" | "insurance";

export type LngLat = [number, number];

export type Place = {
  id: string;
  name: string;
  address: string;
  coord: LngLat;
  category?: PlaceCategory;
  meta?: string;
};

export type RoutePref =
  | "fast"
  | "cheap"
  | "few-tolls"
  | "coast"
  | "highway"
  | "scenic";

export type RouteResult = {
  id: string;
  label: string;
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
  tollVnd: number;
  tollStops: number;
  tags: RoutePref[];
  path: LngLat[];
};
