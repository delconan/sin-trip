export interface PlaceResult {
  title: string;
  address: string;
  latitude: number;
  longitude: number;
}

export type PlaceResolution =
  | { kind: "resolved"; place: PlaceResult }
  | { kind: "ambiguous"; results: PlaceResult[] }
  | { kind: "unresolved"; results: [] };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function searchPlaces(query: string, fetcher: Fetcher = fetch): Promise<PlaceResult[]> {
  const response = await fetcher(`/api/places?q=${encodeURIComponent(query.trim())}`);
  if (!response.ok) throw new Error("OneMap 地点查询失败");
  const payload = await response.json() as { results?: PlaceResult[] };
  return (payload.results ?? []).filter((place) => (
    place.address && Number.isFinite(place.latitude) && Number.isFinite(place.longitude)
  ));
}

export async function resolvePlaceAddress(query: string, fetcher: Fetcher = fetch): Promise<PlaceResolution> {
  const results = await searchPlaces(query, fetcher);
  if (results.length === 1) return { kind: "resolved", place: results[0] };
  if (results.length > 1) return { kind: "ambiguous", results };
  return { kind: "unresolved", results: [] };
}
