export const placeEmoji = (type) => {
  const map = { cafe: "☕", restaurant: "🍽️", fast_food: "🍔", bar: "🍺" };
  return map[type] || "📍";
};

export const formatDuration = (min) => {
  if (!min) return "N/A";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
};

export const formatDistance = (km) => {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

export const getFairnessColor = (score) => {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
};
