import React from "react";
import { formatDuration, formatDistance, getFairnessColor, placeEmoji } from "../utils/formatters";

function ResultsPanel({
  midpoint,
  destinationData,
  distances,
  places,
  touristPlaces,
  selectedTouristPlace,
  fairness,
  travelMode,
  copied,
  handleShare,
  handleGoToTouristPlace,
  isTracking,
  toggleLiveTracking,
}) {
  return (
    <div className="results-section">
      <div className="result-card success">
        <h4>📌 Meeting Point (Optimal)</h4>
        <div className="midpoint-coords">
          <div className="coord-badge">{midpoint.lat.toFixed(4)}</div>
          <div className="coord-badge">{midpoint.lng.toFixed(4)}</div>
        </div>

        {/* Live Tracking Toggle Toggle */}
        <button 
          onClick={toggleLiveTracking} 
          className="start-nav-btn main-nav-btn"
          style={{ background: isTracking ? '#ef4444' : 'var(--accent)', marginTop: '8px' }}
        >
          {isTracking ? "🛑 Stop Live Tracking" : "📡 Start Live Route Tracking Here"}
        </button>
        <div style={{ textAlign: "center", margin: "6px 0", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: "500" }}>OR</div>
        <a 
          href={`https://www.google.com/maps/dir/?api=1&destination=${midpoint.lat},${midpoint.lng}`}
          target="_blank" 
          rel="noopener noreferrer"
          className="start-nav-btn main-nav-btn"
          style={{ marginTop: 0 }}
        >
          🚀 Open in Google Maps
        </a>

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

      {/* Destination Overview */}
      {destinationData && (
        <div className="result-card" style={{ borderLeft: '4px solid #8b5cf6' }}>
          <h4>🌟 Route to {destinationData.name}</h4>
          <div className="eta-item" style={{ marginTop: '12px' }}>
            <div className="eta-left">
              <div className="eta-dot" style={{ background: '#8b5cf6' }} />
              <span className="eta-name">From Meeting Point</span>
            </div>
            <div className="eta-right">
              <div className="eta-time">{formatDuration(destinationData.durationMin)}</div>
              <div className="eta-distance">{formatDistance(destinationData.distanceKm)}</div>
              <a 
                href={`https://www.google.com/maps/dir/?api=1&origin=${midpoint.lat},${midpoint.lng}&destination=${destinationData.lat},${destinationData.lng}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="start-nav-btn small-nav-btn"
                style={{ background: '#8b5cf6', color: "white" }}
              >
                🚀 Navigate Together
              </a>
            </div>
          </div>
        </div>
      )}

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
                  <a 
                    href={`https://www.google.com/maps/dir/?api=1&origin=${d.lat},${d.lng}&destination=${midpoint.lat},${midpoint.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="start-nav-btn small-nav-btn"
                  >
                    🚀 Directions
                  </a>
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

      {/* 🌍 Trip Ideas — Tourist places near midpoint */}
      {touristPlaces.length > 0 && (
        <div className="result-card" style={{ borderLeft: '4px solid #10b981' }}>
          <h4>🌍 Trip Ideas Near Meeting Point</h4>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '4px 0 10px' }}>Tap a place to set it as your group's final destination</p>
          <div className="places-list">
            {touristPlaces.map((p, i) => (
              <div
                key={i}
                className={`place-item tourist-place-item ${selectedTouristPlace && selectedTouristPlace.name === p.name ? 'selected-trip' : ''}`}
                style={{ cursor: 'pointer', flexWrap: 'wrap', gap: '6px' }}
              >
                <div className="place-icon" style={{ fontSize: '1.3rem' }}>{p.emoji}</div>
                <div className="place-info" style={{ flex: 1 }}>
                  <div className="place-name">{p.name}</div>
                  <div className="place-type" style={{ textTransform: 'capitalize' }}>{p.category.replace(/_/g, ' ')}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <div className="place-dist">{formatDistance(p.distKm)}</div>
                  <button
                    onClick={() => handleGoToTouristPlace(p)}
                    className="start-nav-btn small-nav-btn"
                    style={{
                      background: selectedTouristPlace && selectedTouristPlace.name === p.name ? '#10b981' : '#6366f1',
                      color: "white",
                      fontSize: '0.7rem', padding: '3px 8px'
                    }}
                  >
                    {selectedTouristPlace && selectedTouristPlace.name === p.name ? '✓ Selected' : '🚀 Go Here'}
                  </button>
                </div>
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
  );
}

export default ResultsPanel;
