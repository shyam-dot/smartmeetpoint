export const haversineDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const calculateFairness = (distArray) => {
  if (distArray.length < 2) return 100;
  const values = distArray.map((d) => d.distanceKm);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const maxDev = Math.max(...values.map((v) => Math.abs(v - avg)));
  const score = Math.max(0, 100 - (maxDev / avg) * 100);
  return Math.round(score);
};

export const calculateOptimalMeetingPoint = (friends, dest) => {
  const points = friends.map(f => ({ lat: f.lat, lng: f.lng, weight: 1 }));
  if (dest) {
     points.push({ lat: dest.lat, lng: dest.lng, weight: 1 });
  }
  
  // Initial guess: centroid
  let currentLat = 0, currentLng = 0;
  let totalWeight = 0;
  for (const p of points) {
    currentLat += p.lat * p.weight;
    currentLng += p.lng * p.weight;
    totalWeight += p.weight;
  }
  currentLat /= totalWeight;
  currentLng /= totalWeight;

  // Weiszfeld's algorithm iterations
  const numIterations = 50;
  for (let iter = 0; iter < numIterations; iter++) {
    let numLat = 0, numLng = 0, den = 0;
    for (const p of points) {
      const dist = Math.max(haversineDistance(currentLat, currentLng, p.lat, p.lng), 0.001);
      const weight = p.weight / dist;
      numLat += p.lat * weight;
      numLng += p.lng * weight;
      den += weight;
    }
    if (den === 0) break;
    currentLat = numLat / den;
    currentLng = numLng / den;
  }
  return { lat: currentLat, lng: currentLng };
};
