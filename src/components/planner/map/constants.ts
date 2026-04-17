// Source & layer IDs used by planner map overlays
export const ROUTE_SRC = "planner-route";
export const ROUTE_LAYER = "planner-route-line";
export const ROUTE_LAYER_CASING = "planner-route-casing";
export const USER_SRC = "planner-user";
export const USER_LAYER = "planner-user-point";
export const USER_LAYER_HALO = "planner-user-halo";
export const VN_ISLANDS_SRC = "planner-vn-islands";
export const VN_ISLANDS_ARCHIPELAGO_LAYER = "planner-vn-islands-archipelago";
export const VN_ISLANDS_ISLAND_LAYER = "planner-vn-islands-island";
export const PLACES_SRC = "planner-places";
export const PLACES_CIRCLE_LAYER = "planner-places-circle";
export const PLACES_LABEL_LAYER = "planner-places-label";
export const PLACES_BORDER_LAYER = "planner-places-border";

// Category color palette for place markers
export const CATEGORY_COLORS: Record<string, string> = {
  eat: "#c2841a",
  cafe: "#a0762a",
  fuel: "#3b82f6",
  charge: "#22c55e",
  parking: "#7c3aed",
  hotel: "#a855f7",
  rest_stop: "#a0762a",
  insurance: "#ec4899",
};
export const DEFAULT_PLACE_COLOR = "#3b82f6";

// Base style URLs (OpenFreeMap vector tiles)
export const LIGHT_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const DARK_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
