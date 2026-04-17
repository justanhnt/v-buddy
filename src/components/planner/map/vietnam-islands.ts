// Bounding boxes covering the Hoang Sa (Paracel) and Truong Sa (Spratly)
// archipelagos. Any place feature from the vector tiles that falls inside
// these areas is suppressed; we re-add correct Vietnamese labels below.
//
// Bounds are intentionally offshore so no mainland labels are affected:
//   Hoang Sa: 110.8-112.9 E x 15.5-17.3 N  -- west of Ly Son (109.1 E)
//             and south of Hainan (~18 N).
//   Truong Sa: 110.5-116.0 E x 6.5-12.0 N -- west of Balabac/Banggi
//             (~117 E, Philippines/Malaysia), north of Luconia Shoals
//             (~5 N, Malaysia claim), and east of Phu Quy (108.9 E).
export const DISPUTED_AREAS: GeoJSON.MultiPolygon = {
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [110.8, 15.5],
        [112.9, 15.5],
        [112.9, 17.3],
        [110.8, 17.3],
        [110.8, 15.5],
      ],
    ],
    [
      [
        [110.5, 6.5],
        [116.0, 6.5],
        [116.0, 12.0],
        [110.5, 12.0],
        [110.5, 6.5],
      ],
    ],
  ],
};

type VnIslandProps = { name: string; kind: "archipelago" | "island" };

export const VN_ISLANDS_GEOJSON: GeoJSON.FeatureCollection<
  GeoJSON.Point,
  VnIslandProps
> = {
  type: "FeatureCollection",
  features: [
    // Archipelago headings
    {
      type: "Feature",
      properties: {
        name: "Quần đảo Hoàng Sa (Việt Nam)",
        kind: "archipelago",
      },
      geometry: { type: "Point", coordinates: [111.9, 16.5] },
    },
    {
      type: "Feature",
      properties: {
        name: "Quần đảo Trường Sa (Việt Nam)",
        kind: "archipelago",
      },
      geometry: { type: "Point", coordinates: [114.0, 9.5] },
    },
    // Hoang Sa -- major islands
    {
      type: "Feature",
      properties: { name: "Đảo Phú Lâm", kind: "island" },
      geometry: { type: "Point", coordinates: [112.333, 16.833] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Hoàng Sa", kind: "island" },
      geometry: { type: "Point", coordinates: [111.617, 16.533] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Tri Tôn", kind: "island" },
      geometry: { type: "Point", coordinates: [111.2, 15.783] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Linh Côn", kind: "island" },
      geometry: { type: "Point", coordinates: [112.733, 16.667] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Cây", kind: "island" },
      geometry: { type: "Point", coordinates: [112.267, 16.9] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Quang Hòa", kind: "island" },
      geometry: { type: "Point", coordinates: [111.7, 16.45] },
    },
    // Truong Sa -- major islands
    {
      type: "Feature",
      properties: { name: "Đảo Trường Sa", kind: "island" },
      geometry: { type: "Point", coordinates: [111.917, 8.65] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Song Tử Tây", kind: "island" },
      geometry: { type: "Point", coordinates: [114.333, 11.433] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Nam Yết", kind: "island" },
      geometry: { type: "Point", coordinates: [114.367, 10.183] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Sơn Ca", kind: "island" },
      geometry: { type: "Point", coordinates: [114.467, 10.383] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Sinh Tồn", kind: "island" },
      geometry: { type: "Point", coordinates: [114.333, 9.883] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo An Bang", kind: "island" },
      geometry: { type: "Point", coordinates: [112.917, 7.883] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Phan Vinh", kind: "island" },
      geometry: { type: "Point", coordinates: [113.7, 8.967] },
    },
    {
      type: "Feature",
      properties: { name: "Đảo Thuyền Chài", kind: "island" },
      geometry: { type: "Point", coordinates: [113.3, 8.183] },
    },
  ],
};
