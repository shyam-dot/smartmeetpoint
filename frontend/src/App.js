import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";
import MapDisplay from "./components/MapDisplay";

const AVATAR_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];

function App() {
  const [friendName, setFriendName] = useState("");
  const [friendLocation, setFriendLocation] = useState("");
  const [friends, setFriends] = useState([]);
  const [coordinates, setCoordinates] = useState([]);
  const [midpoint, setMidpoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [travelMode, setTravelMode] = useState("car");
  const [distances, setDistances] = useState([]);
  const [places, setPlaces] = useState([]);
  const [fairness, setFairness] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const mapRef = useRef(null);

  const handleAddFriend = () => {
    const loc = friendLocation.trim();
    const name = friendName.trim() || `Friend ${friends.length + 1}`;
    if (!loc) {
      setError("Please enter a location");
      return;
    }
    if (friends.find((f) => f.location === loc)) {
      setError("This location is already added");
      return;
    }

    const usedColors = friends.map(f => f.color);
    const availableColors = AVATAR_COLORS.filter(c => !usedColors.includes(c));
    const nextColor = availableColors.length > 0 ? availableColors[0] : AVATAR_COLORS[friends.length % AVATAR_COLORS.length];

    setFriends([...friends, {
      name,
      location: loc,
      color: nextColor,
    }]);
    setFriendName("");
    setFriendLocation("");
    setError(null);
  };

  const handleEditFriend = (index) => {
    setEditingIndex(index);
    setEditName(friends[index].name);
    setEditLocation(friends[index].location);
  };

  const handleSaveEdit = (index) => {
    const loc = editLocation.trim();
    if (!loc) {
      setEditingIndex(null);
      return;
    }
    
    // Check if new location is already in another friend's address
    if (friends.some((f, i) => i !== index && f.location === loc)) {
      setError("This location is already added by someone else");
      return;
    }
    
    const newFriends = [...friends];
    newFriends[index] = { ...newFriends[index], name: editName.trim() || `Friend ${index + 1}`, location: loc };
    setFriends(newFriends);
    setEditingIndex(null);
    setError(null);
    
    // Reset results since a location changed
    setCoordinates([]);
    setMidpoint(null);
    setDistances([]);
    setPlaces([]);
    setFairness(null);
  };

  const handleRemoveFriend = (index) => {
    const newFriends = friends.filter((_, i) => i !== index);
    setFriends(newFriends);
    if (newFriends.length < 2) {
      setCoordinates([]);
      setMidpoint(null);
      setDistances([]);
      setPlaces([]);
      setFairness(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddFriend();
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(4);
        const lng = pos.coords.longitude.toFixed(4);
        setFriendLocation(`${lat}, ${lng}`);
        if (!friendName.trim()) setFriendName("Me");
      },
      () => setError("Could not get your location. Please allow permissions.")
    );
  };

  const geocodeLocation = async (location) => {
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

  const getRouteDistance = async (fromLat, fromLng, toLat, toLng, profile) => {
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

  const fetchNearbyPlaces = async (lat, lng) => {
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

  const haversineDistance = (lat1, lng1, lat2, lng2) => {
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

  const calculateFairness = (distArray) => {
    if (distArray.length < 2) return 100;
    const values = distArray.map((d) => d.distanceKm);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxDev = Math.max(...values.map((v) => Math.abs(v - avg)));
    const score = Math.max(0, 100 - (maxDev / avg) * 100);
    return Math.round(score);
  };

  const handleFindMeetingPoint = async () => {
    if (friends.length < 2) {
      setError("Add at least 2 friends to find a meeting point");
      return;
    }

    setLoading(true);
    setError(null);
    setDistances([]);
    setPlaces([]);
    setFairness(null);

    try {
      // 1. Geocode all
      const geocodeResults = [];
      for (const f of friends) {
        const result = await geocodeLocation(f.location);
        if (result) {
          geocodeResults.push({
            name: f.name,
            location: f.location,
            lat: result.lat,
            lng: result.lng,
            display: result.display,
            color: f.color,
          });
        } else {
          setError(`Could not find: "${f.location}". Try being more specific.`);
        }
      }

      if (geocodeResults.length < 2) {
        setError("Need at least 2 valid locations.");
        setLoading(false);
        return;
      }

      setCoordinates(geocodeResults);

      // 2. Calculate midpoint
      let sumLat = 0, sumLng = 0;
      geocodeResults.forEach((c) => { sumLat += c.lat; sumLng += c.lng; });
      const mid = { lat: sumLat / geocodeResults.length, lng: sumLng / geocodeResults.length };
      setMidpoint(mid);

      // 3. Routes + distances
      const routeResults = [];
      for (const coord of geocodeResults) {
        const route = await getRouteDistance(coord.lat, coord.lng, mid.lat, mid.lng, travelMode);
        routeResults.push({
          name: coord.name,
          color: coord.color,
          distanceKm: route ? route.distance / 1000 : haversineDistance(coord.lat, coord.lng, mid.lat, mid.lng),
          durationMin: route ? route.duration / 60 : null,
          geometry: route ? route.geometry : null,
        });
      }
      setDistances(routeResults);

      // 4. Fairness
      setFairness(calculateFairness(routeResults));

      // 5. Nearby places
      const nearbyPlaces = await fetchNearbyPlaces(mid.lat, mid.lng);
      const enrichedPlaces = nearbyPlaces.map((p) => ({
        ...p,
        distKm: haversineDistance(mid.lat, mid.lng, p.lat, p.lon),
      }));
      enrichedPlaces.sort((a, b) => a.distKm - b.distKm);
      setPlaces(enrichedPlaces.slice(0, 6));
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFriends([]);
    setCoordinates([]);
    setMidpoint(null);
    setDistances([]);
    setPlaces([]);
    setFairness(null);
    setError(null);
    setFriendName("");
    setFriendLocation("");
  };

  const handleShare = () => {
    if (!midpoint) return;
    const text = `MeetHub - Meeting Point\n📍 ${midpoint.lat.toFixed(4)}, ${midpoint.lng.toFixed(4)}\n\nFriends:\n${friends.map((f) => `• ${f.name}: ${f.location}`).join("\n")}\n\nFairness Score: ${fairness}%`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const placeEmoji = (type) => {
    const map = { cafe: "☕", restaurant: "🍽️", fast_food: "🍔", bar: "🍺" };
    return map[type] || "📍";
  };

  const formatDuration = (min) => {
    if (!min) return "N/A";
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}m`;
  };

  const formatDistance = (km) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const getFairnessColor = (score) => {
    if (score >= 80) return "#10b981";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="app-container">
      <div className="side-panel">
        <header className="panel-header">
          <h1>MeetHub<span className="logo-dot"></span></h1>
          <p>Find the perfect meeting spot for everyone</p>
        </header>

        <div className="panel-content">
          {/* Friend Name + Location Input */}
          <div className="search-section">
            <h3>Add a Friend</h3>
            <div className="name-input-row">
              <input
                type="text"
                placeholder="Name (optional)"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
              />
            </div>
            <div className="search-box">
              <input
                type="text"
                placeholder="Enter location (e.g. Adyar, Chennai)"
                value={friendLocation}
                onChange={(e) => setFriendLocation(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button onClick={handleAddFriend} disabled={!friendLocation.trim()}>
                Add
              </button>
            </div>
          </div>

          {/* My Location Button */}
          <button className="my-location-btn" onClick={useMyLocation}>
            📍 Use My Current Location
          </button>

          {/* Travel Mode */}
          <div className="travel-mode">
            <button className={travelMode === "car" ? "active" : ""} onClick={() => setTravelMode("car")} title="Drive">🚗</button>
            <button className={travelMode === "bike" ? "active" : ""} onClick={() => setTravelMode("bike")} title="Cycle">🚲</button>
            <button className={travelMode === "walk" ? "active" : ""} onClick={() => setTravelMode("walk")} title="Walk">🚶</button>
          </div>

          {/* Friends List */}
          {friends.length > 0 && (
            <div className="friends-list">
              {friends.map((f, i) => (
                <div key={i} className={`friend-card ${editingIndex === i ? "editing" : ""}`}>
                  {editingIndex === i ? (
                    <div className="edit-form">
                      <input 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        placeholder="Name (optional)" 
                      />
                      <input 
                        value={editLocation} 
                        onChange={(e) => setEditLocation(e.target.value)} 
                        placeholder="Location" 
                        onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(i)}
                      />
                      <div className="edit-actions">
                        <button className="edit-save" onClick={() => handleSaveEdit(i)}>Save</button>
                        <button className="edit-cancel" onClick={() => setEditingIndex(null)}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="friend-avatar" style={{ background: f.color }}>
                        {f.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="friend-info">
                        <div className="friend-name">{f.name}</div>
                        <div className="friend-location-text">{f.location}</div>
                      </div>
                      <div className="friend-actions">
                        <button className="friend-edit" title="Edit" onClick={() => handleEditFriend(i)}>✎</button>
                        <button className="friend-remove" title="Remove" onClick={() => handleRemoveFriend(i)}>×</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Errors */}
          {error && <div className="error-toast">⚠️ {error}</div>}

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleFindMeetingPoint} disabled={loading || friends.length < 2}>
              {loading ? "Calculating..." : "🔍 Find Meeting Point"}
            </button>
            <button className="btn btn-secondary" onClick={handleClear} disabled={friends.length === 0}>
              Clear
            </button>
          </div>

          {/* Results */}
          {midpoint && !loading && (
            <div className="results-section">
              {/* Meeting Point */}
              <div className="result-card success">
                <h4>📌 Meeting Point</h4>
                <div className="midpoint-coords">
                  <span className="coord-badge">{midpoint.lat.toFixed(4)}°</span>
                  <span className="coord-badge">{midpoint.lng.toFixed(4)}°</span>
                </div>

                {/* Fairness */}
                {fairness !== null && (
                  <div className="fairness-meter">
                    <div className="fairness-label">
                      <span>Fairness Score</span>
                      <span className="fairness-score" style={{ color: getFairnessColor(fairness) }}>
                        {fairness}%
                      </span>
                    </div>
                    <div className="fairness-bar">
                      <div
                        className="fairness-fill"
                        style={{
                          width: `${fairness}%`,
                          background: `linear-gradient(90deg, ${getFairnessColor(fairness)}, ${getFairnessColor(fairness)}88)`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* ETAs */}
              {distances.length > 0 && (
                <div className="result-card">
                  <h4>🕐 Travel Times ({travelMode === "car" ? "Driving" : travelMode === "bike" ? "Cycling" : "Walking"})</h4>
                  <div className="eta-list">
                    {distances.map((d, i) => (
                      <div key={i} className="eta-item">
                        <div className="eta-left">
                          <div className="eta-dot" style={{ background: d.color }} />
                          <span className="eta-name">{d.name}</span>
                        </div>
                        <div className="eta-right">
                          <div className="eta-time">{formatDuration(d.durationMin)}</div>
                          <div className="eta-distance">{formatDistance(d.distanceKm)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nearby Places */}
              {places.length > 0 && (
                <div className="result-card">
                  <h4>🏪 Nearby Places to Meet</h4>
                  <div className="places-list">
                    {places.map((p, i) => (
                      <div key={i} className="place-item">
                        <div className="place-icon">{placeEmoji(p.type)}</div>
                        <div className="place-info">
                          <div className="place-name">{p.name}</div>
                          <div className="place-type">{p.cuisine || p.type}</div>
                        </div>
                        <div className="place-dist">{formatDistance(p.distKm)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Share */}
              <button className={`share-btn ${copied ? "copied" : ""}`} onClick={handleShare}>
                {copied ? "✓ Copied to Clipboard!" : "📤 Share Meeting Details"}
              </button>
            </div>
          )}

          {/* Empty State */}
          {friends.length === 0 && !loading && (
            <div className="empty-state">
              <div className="icon">👥</div>
              <p>Add your friends' locations to find the<br />perfect meeting point for everyone!</p>
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div className="map-section">
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <span className="loading-text">Finding the optimal point...</span>
          </div>
        )}
        <MapDisplay
          coordinates={coordinates}
          midpoint={midpoint}
          distances={distances}
          places={places}
          mapRef={mapRef}
        />
      </div>
    </div>
  );
}

export default App;
