import axios from "axios";

export const geocodeLocation = async (location) => {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
  const response = await axios.get(url, {
    headers: { "Accept-Language": "en" },
  });
  if (response.data && response.data.length > 0) {
    return {
      lat: parseFloat(response.data[0].lat),
      lng: parseFloat(response.data[0].lon),
      display: response.data[0].display_name,
    };
  }
  return null;
};

export const getRouteDistance = async (fromLat, fromLng, toLat, toLng, profile) => {
  const profileMap = { car: "car", bike: "bike", walk: "foot" };
  const p = profileMap[profile] || "car";
  try {
    const url = `https://router.project-osrm.org/route/v1/${p === "car" ? "driving" : p === "bike" ? "cycling" : "walking"}/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`;
    const res = await axios.get(url);
    if (res.data && res.data.routes && res.data.routes.length > 0) {
      const route = res.data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      };
    }
  } catch (e) {
    console.error("Route error:", e);
  }
  return null;
};

export const fetchNearbyPlaces = async (lat, lng) => {
  const overpassQuery = `
    [out:json][timeout:10];
    (
      node["amenity"~"cafe|restaurant|fast_food|bar"](around:1500,${lat},${lng});
    );
    out body 8;
  `;
  try {
    const res = await axios.post(
      "https://overpass-api.de/api/interpreter",
      `data=${encodeURIComponent(overpassQuery)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    if (res.data && res.data.elements) {
      return res.data.elements.map((el) => ({
        name: el.tags?.name || "Unnamed Place",
        type: el.tags?.amenity || "place",
        cuisine: el.tags?.cuisine || "",
        lat: el.lat,
        lon: el.lon,
      }));
    }
  } catch (e) {
    console.error("Overpass error:", e);
  }
  return [];
};

export const fetchNearbyTouristPlaces = async (lat, lng) => {
  const radius = 50000; // 50km
  const overpassQuery = `
    [out:json][timeout:15];
    (
      node["tourism"~"attraction|viewpoint|theme_park|zoo|museum|artwork|camp_site|picnic_site|information|gallery"](around:${radius},${lat},${lng});
      node["natural"~"waterfall|peak|cave_entrance|hot_spring|beach|spring"](around:${radius},${lat},${lng});
      node["leisure"~"park|nature_reserve|garden|swimming_area"](around:${radius},${lat},${lng});
      node["historic"~"memorial|monument|ruins|castle"](around:${radius},${lat},${lng});
      way["tourism"~"attraction|viewpoint|theme_park|museum"](around:${radius},${lat},${lng});
      way["natural"~"waterfall|peak|beach"](around:${radius},${lat},${lng});
      way["leisure"~"park|nature_reserve|garden"](around:${radius},${lat},${lng});
    );
    out center 20;
  `;
  try {
    const res = await axios.post(
      "https://overpass-api.de/api/interpreter",
      `data=${encodeURIComponent(overpassQuery)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    if (res.data && res.data.elements) {
      return res.data.elements
        .filter(el => {
          const tags = el.tags || {};
          const name = tags.name;
          return name && name.trim() !== "";
        })
        .map((el) => {
          const tags = el.tags || {};
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          const category = tags.tourism || tags.natural || tags.leisure || tags.historic || "place";
          const emojiMap = {
            waterfall: "🌊", peak: "⛰️", viewpoint: "🔭", attraction: "🎡",
            park: "🌳", nature_reserve: "🌿", museum: "🏛️", zoo: "🦁",
            theme_park: "🎢", beach: "🏖️", cave_entrance: "🕳️", hot_spring: "♨️",
            camp_site: "⛺", picnic_site: "🧺", garden: "🌸",
            memorial: "🗿", monument: "🗽", ruins: "🏚️", castle: "🏰",
            swimming_area: "🏊", spring: "💧",
          };
          return {
            name: tags.name,
            category,
            emoji: emojiMap[category] || "📍",
            lat,
            lon,
          };
        })
        .filter(p => p.lat && p.lon);
    }
  } catch (e) {
    console.error("Tourist places overpass error:", e);
  }
  return [];
};
