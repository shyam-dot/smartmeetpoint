import React, { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import "./App.css";
import MapDisplay from "./components/MapDisplay";
import ResultsPanel from "./components/ResultsPanel";
import FriendList from "./components/FriendList";
import { geocodeLocation, getRouteDistance, fetchNearbyPlaces, fetchNearbyTouristPlaces } from "./services/api";
import { haversineDistance, calculateFairness, calculateOptimalMeetingPoint } from "./utils/math";

const AVATAR_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
];
const socket = io("http://localhost:3001");

function App() {
  const [friendName, setFriendName] = useState("");
  const [friendLocation, setFriendLocation] = useState("");
  const [friends, setFriends] = useState([]);
  const [destinationInput, setDestinationInput] = useState("");
  const [destinationData, setDestinationData] = useState(null);
  const [coordinates, setCoordinates] = useState([]);
  const [midpoint, setMidpoint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [travelMode, setTravelMode] = useState("car");
  const [distances, setDistances] = useState([]);
  const [places, setPlaces] = useState([]);
  const [touristPlaces, setTouristPlaces] = useState([]);
  const [selectedTouristPlace, setSelectedTouristPlace] = useState(null);
  const [fairness, setFairness] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  const [liveLocation, setLiveLocation] = useState(null);
  const [otherLiveLocations, setOtherLiveLocations] = useState({});
  const trackingIdRef = useRef(null);
  const mapRef = useRef(null);

  const [sessionId, setSessionId] = useState(() => {
    // Generate or get existing session ID
    return Math.random().toString(36).substring(2, 9);
  });

  // Setup Socket, Shared Session Syncing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get("session");
    
    // Automatically join the session
    const currentSession = urlSession || sessionId;
    if (urlSession && urlSession !== sessionId) {
      setSessionId(urlSession);
    }
    
    socket.emit("join_session", currentSession);

    // Initial data load from share link (legacy fallback just in case)
    const sharedData = params.get("data");
    if (sharedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(sharedData));
        if (decoded && Array.isArray(decoded) && decoded.length > 0) {
          setFriends(decoded);
          socket.emit("sync_friends", { sessionId: currentSession, friends: decoded });
          setTimeout(() => handleFindMeetingPoint(decoded), 100);
        }
      } catch (e) {
        console.error("Failed to parse shared data");
      }
    }

    // Listen for live updates from OTHER users in the session
    const handleUpdate = (updatedFriends) => {
      setFriends(updatedFriends);
      // Auto-recalculate meeting spot for everyone when data changes!
      if (updatedFriends.length >= 2) {
        handleFindMeetingPoint(updatedFriends);
      } else {
        setCoordinates([]);
        setMidpoint(null);
        setDistances([]);
        setPlaces([]);
        setTouristPlaces([]);
        setFairness(null);
        setDestinationData(null);
      }
    };

    socket.on("update_friends", handleUpdate);
    
    socket.on("update_live_location", (data) => {
      if (data && data.userId) {
        setOtherLiveLocations(prev => ({ ...prev, [data.userId]: { lat: data.lat, lng: data.lng } }));
      }
    });
    
    socket.on("remove_live_location", (userId) => {
      setOtherLiveLocations(prev => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    });

    // Cleanup
    return () => {
      socket.off("update_friends", handleUpdate);
      socket.off("update_live_location");
      socket.off("remove_live_location");
    };
    // eslint-disable-next-line
  }, []);

  const syncToNetwork = (newFriends) => {
    setFriends(newFriends);
    socket.emit("sync_friends", { sessionId, friends: newFriends });
  };

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

    const newFriendsList = [...friends, {
      name,
      location: loc,
      color: nextColor,
    }];
    
    syncToNetwork(newFriendsList);
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
    
    syncToNetwork(newFriends);
    setEditingIndex(null);
    setError(null);
    
    // Reset results since a location changed
    setCoordinates([]);
    setMidpoint(null);
    setDistances([]);
    setPlaces([]);
    setTouristPlaces([]);
    setFairness(null);
    setDestinationData(null);
  };

  const handleRemoveFriend = (index) => {
    const newFriends = friends.filter((_, i) => i !== index);
    syncToNetwork(newFriends);
    if (newFriends.length < 2) {
      setCoordinates([]);
      setMidpoint(null);
      setDistances([]);
      setPlaces([]);
      setTouristPlaces([]);
      setFairness(null);
      setDestinationData(null);
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
  const handleFindMeetingPoint = async (friendsData = null, overrideDestGeo = null) => {
    const currentFriends = (Array.isArray(friendsData) && friendsData.length > 0) ? friendsData : friends;

    if (currentFriends.length < 2) {
      setError("Add at least 2 friends to find a meeting point");
      return;
    }

    setLoading(true);
    setError(null);
    setDistances([]);
    setPlaces([]);
    setTouristPlaces([]);
    setSelectedTouristPlace(null);
    setFairness(null);
    setDestinationData(null);

    try {
      // 1. Geocode all
      const geocodeResults = [];
      for (const f of currentFriends) {
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

      let maxDist = 0;
      let f1 = null, f2 = null;
      for (let i = 0; i < geocodeResults.length; i++) {
        for (let j = i + 1; j < geocodeResults.length; j++) {
           const d = haversineDistance(geocodeResults[i].lat, geocodeResults[i].lng, geocodeResults[j].lat, geocodeResults[j].lng);
           if (d > maxDist) {
             maxDist = d;
             f1 = geocodeResults[i];
             f2 = geocodeResults[j];
           }
        }
      }

      if (maxDist > 500) {
        let route = null;
        try {
           route = await getRouteDistance(f1.lat, f1.lng, f2.lat, f2.lng, travelMode);
        } catch(e){}
        const distKm = route ? route.distance / 1000 : maxDist;
        const durationMin = route ? route.duration / 60 : null;
        
        setError(`This is out of range. The limit is 500km.`);
        setLoading(false);
        return;
      }

      // 2. Calculate optimal midpoint
      let mid = null;
      let destGeocode = overrideDestGeo;
      let destRoute = null;

      if (!destGeocode && destinationInput.trim()) {
        destGeocode = await geocodeLocation(destinationInput.trim());
      }
      if (destGeocode) {
        const destLat = destGeocode.lat;
        const destLng = destGeocode.lng !== undefined ? destGeocode.lng : destGeocode.lon;
        
        let mergeMid = null;
        try {
          const routesToDest = [];
          for (const f of geocodeResults) {
            const r = await getRouteDistance(f.lat, f.lng, destLat, destLng, travelMode);
            if (r && r.geometry && r.geometry.coordinates) {
              routesToDest.push(r.geometry.coordinates); // GeoJSON LineString coordinates: [[lng, lat]]
            }
          }
          // Find the earliest geographic point where ALL friends' routes naturally converge!
          if (routesToDest.length === geocodeResults.length) {
            const r0 = routesToDest[0];
            for (let i = 0; i < r0.length; i += Math.max(1, Math.floor(r0.length / 100))) { // Sample along the route
              const pt0 = r0[i];
              let allMatch = true;
              for (let j = 1; j < routesToDest.length; j++) {
                const rj = routesToDest[j];
                let foundMatch = false;
                for (let k = 0; k < rj.length; k += Math.max(1, Math.floor(rj.length / 100))) {
                  const ptk = rj[k];
                  // If within 250 meters of an intersection, consider it a road merge
                  if (haversineDistance(pt0[1], pt0[0], ptk[1], ptk[0]) < 0.25) { 
                    foundMatch = true;
                    break;
                  }
                }
                if (!foundMatch) {
                  allMatch = false;
                  break;
                }
              }
              if (allMatch) {
                mergeMid = { lat: pt0[1], lng: pt0[0] };
                break;
              }
            }
          }
        } catch(e) { console.error("Merge calculation failed", e); }

        if (mergeMid) {
          mid = mergeMid;
        } else {
          const optimalCoords = calculateOptimalMeetingPoint(geocodeResults, { lat: destLat, lng: destLng });
          mid = { lat: optimalCoords.lat, lng: optimalCoords.lng };
        }
        
        // Compute destRoute from this optimal geometric midpoint to the destination
        const route = await getRouteDistance(mid.lat, mid.lng, destLat, destLng, travelMode);
        destRoute = {
          name: destGeocode.name || destinationInput.trim() || destGeocode.display || "Destination",
          color: "#8b5cf6",
          lat: destLat,
          lng: destLng,
          distanceKm: route ? route.distance / 1000 : haversineDistance(mid.lat, mid.lng, destLat, destLng),
          durationMin: route ? route.duration / 60 : null,
          geometry: route ? route.geometry : null,
          display: destGeocode.display || destGeocode.name
        };
      } else {
        // Normal midpoint calculation (optimal geometric median of all friends)
        const optimalCoords = calculateOptimalMeetingPoint(geocodeResults, null);
        mid = { lat: optimalCoords.lat, lng: optimalCoords.lng };
        
        if (destinationInput.trim()) {
           setError(`Could not find destination: "${destinationInput}". Proceeding without it.`);
        }
      }

      setMidpoint(mid);
      setDestinationData(destRoute);

      // 3. Routes + distances
      const routeResults = [];
      for (const coord of geocodeResults) {
        const route = await getRouteDistance(coord.lat, coord.lng, mid.lat, mid.lng, travelMode);
        routeResults.push({
          name: coord.name,
          color: coord.color,
          lat: coord.lat,
          lng: coord.lng,
          distanceKm: route ? route.distance / 1000 : haversineDistance(coord.lat, coord.lng, mid.lat, mid.lng),
          durationMin: route ? route.duration / 60 : null,
          geometry: route ? route.geometry : null,
        });
      }
      setDistances(routeResults);

      // 4. Fairness
      setFairness(calculateFairness(routeResults));

      // 5. Nearby places (food/cafe)
      const nearbyPlaces = await fetchNearbyPlaces(mid.lat, mid.lng);
      const enrichedPlaces = nearbyPlaces.map((p) => ({
        ...p,
        distKm: haversineDistance(mid.lat, mid.lng, p.lat, p.lon),
      }));
      enrichedPlaces.sort((a, b) => a.distKm - b.distKm);
      setPlaces(enrichedPlaces.slice(0, 6));

      // 6. Tourist / trip-idea places near midpoint
      const rawTouristPlaces = await fetchNearbyTouristPlaces(mid.lat, mid.lng);
      const enrichedTourist = rawTouristPlaces.map((p) => ({
        ...p,
        distKm: haversineDistance(mid.lat, mid.lng, p.lat, p.lon),
      }));
      enrichedTourist.sort((a, b) => a.distKm - b.distKm);
      setTouristPlaces(enrichedTourist.slice(0, 10));
    } catch (err) {
      console.error(err);
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const toggleLiveTracking = () => {
    if (isTracking) {
      if (trackingIdRef.current) navigator.geolocation.clearWatch(trackingIdRef.current);
      setIsTracking(false);
      setLiveLocation(null);
      socket.emit("stop_live_location", { sessionId, userId: socket.id });
    } else {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser");
        return;
      }
      setIsTracking(true);
      let isFirstTrack = true;
      trackingIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setLiveLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          socket.emit("sync_live_location", { 
            sessionId, 
            userId: socket.id, 
            lat: pos.coords.latitude, 
            lng: pos.coords.longitude 
          });
          // Center the map onto user location on the first track
          if (mapRef.current && isFirstTrack) {
             mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
             isFirstTrack = false;
          }
        },
        (err) => {
          setError("Failed to track location: " + err.message);
          setIsTracking(false);
        },
        { enableHighAccuracy: true, maximumAge: 0 }
      );
    }
  };

  const handleClear = () => {
    syncToNetwork([]);
    setCoordinates([]);
    setMidpoint(null);
    setDistances([]);
    setPlaces([]);
    setTouristPlaces([]);
    setSelectedTouristPlace(null);
    setFairness(null);
    setDestinationData(null);
    setError(null);
    setFriendName("");
    setFriendLocation("");
    setDestinationInput("");
    if (isTracking && trackingIdRef.current) {
      navigator.geolocation.clearWatch(trackingIdRef.current);
    }
    if (isTracking) {
      socket.emit("stop_live_location", { sessionId, userId: socket.id });
    }
    setIsTracking(false);
    setLiveLocation(null);
  };

  const handleShare = () => {
    if (!midpoint) return;
    
    // Generate modern interactive session URL
    const shareUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;

    const text = `MeetHub - Live Interactive Map 🌍\n\nClick the link to join our live session, add your location, and find the perfect meeting spot together instantly!\n\n${shareUrl}\n\n📍 Current Meeting Point: ${midpoint.lat.toFixed(4)}, ${midpoint.lng.toFixed(4)}`;
    
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };



  const handleGoToTouristPlace = (place) => {
    setSelectedTouristPlace(place);
    setDestinationInput(place.name);
    // Instantly calculate optimal meeting route for this new destination
    handleFindMeetingPoint(null, {
      lat: place.lat,
      lng: place.lon,
      name: place.name,
      display: place.name
    });
  };

  const allLiveLocations = [
    ...(liveLocation ? [{ ...liveLocation, id: "me" }] : []),
    ...Object.keys(otherLiveLocations).map(id => ({ ...otherLiveLocations[id], id }))
  ];

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

          {/* Friends List Component */}
          {friends.length > 0 && (
            <FriendList
              friends={friends}
              editingIndex={editingIndex}
              editName={editName}
              editLocation={editLocation}
              setEditName={setEditName}
              setEditLocation={setEditLocation}
              handleSaveEdit={handleSaveEdit}
              handleEditFriend={handleEditFriend}
              handleRemoveFriend={handleRemoveFriend}
              setEditingIndex={setEditingIndex}
            />
          )}

          {/* Errors */}
          {error && <div className="error-toast">⚠️ {error}</div>}

          {/* Destination Form */}
          <div className="search-section" style={{ marginTop: '16px' }}>
            <h3>Final Destination (Optional)</h3>
            <div className="search-box">
              <input
                type="text"
                placeholder="Where to together? (e.g. Tada Waterfalls)"
                value={destinationInput}
                onChange={(e) => setDestinationInput(e.target.value)}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleFindMeetingPoint} disabled={loading || friends.length < 2}>
              {loading ? "Calculating..." : "🔍 Find Meeting Point"}
            </button>
            <button className="btn btn-secondary" onClick={handleClear} disabled={friends.length === 0}>
              Clear
            </button>
          </div>

          {/* Results section */}
          {midpoint && !loading && (
            <ResultsPanel
              midpoint={midpoint}
              destinationData={destinationData}
              distances={distances}
              places={places}
              touristPlaces={touristPlaces}
              selectedTouristPlace={selectedTouristPlace}
              fairness={fairness}
              travelMode={travelMode}
              copied={copied}
              handleShare={handleShare}
              handleGoToTouristPlace={handleGoToTouristPlace}
              isTracking={isTracking}
              toggleLiveTracking={toggleLiveTracking}
            />
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
          touristPlaces={touristPlaces}
          liveLocations={allLiveLocations}
          destinationData={destinationData}
          mapRef={mapRef}
        />
      </div>
    </div>
  );
}

export default App;
