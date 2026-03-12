import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons for Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const createColoredIcon = (color) => {
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="
      width: 24px; height: 24px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const midpointIcon = L.divIcon({
  className: "midpoint-marker",
  html: `<div style="
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #10b981, #3b82f6);
    border: 3px solid white;
    border-radius: 50%;
    box-shadow: 0 0 20px rgba(16, 185, 129, 0.5), 0 2px 10px rgba(0,0,0,0.4);
    display: flex; align-items: center; justify-content: center;
    animation: pulse 2s ease-in-out infinite;
  "><span style="font-size: 14px;">📍</span></div>
  <style>
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
  </style>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const placeIcon = L.divIcon({
  className: "place-marker",
  html: `<div style="
    width: 20px; height: 20px;
    background: #f59e0b;
    border: 2px solid white;
    border-radius: 4px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

function MapDisplay({ coordinates, midpoint, distances, places, touristPlaces, liveLocations, destinationData, mapRef }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef([]);

  // Cleanup layers
  const clearLayers = () => {
    layersRef.current.forEach((layer) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    layersRef.current = [];
  };

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [11.0, 78.5], // Tamil Nadu center
      zoom: 7,
      zoomControl: false,
    });

    // Light tile layer
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstanceRef.current = map;
    if (mapRef) mapRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line
  }, []);

  // Update markers and routes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    clearLayers();

    if (!coordinates || coordinates.length === 0) return;

    const bounds = L.latLngBounds([]);

    // Add friend markers
    coordinates.forEach((coord) => {
      const marker = L.marker([coord.lat, coord.lng], {
        icon: createColoredIcon(coord.color),
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: Inter, sans-serif;">
            <strong>${coord.name}</strong><br/>
            <span style="font-size: 12px; color: #666;">${coord.display || coord.location}</span>
          </div>`
        );
      layersRef.current.push(marker);
      bounds.extend([coord.lat, coord.lng]);
    });

    // Add midpoint
    if (midpoint) {
      const mp = L.marker([midpoint.lat, midpoint.lng], { icon: midpointIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: Inter, sans-serif;">
            <strong>📍 Meeting Point</strong><br/>
            <span style="font-size: 12px;">${midpoint.lat.toFixed(4)}, ${midpoint.lng.toFixed(4)}</span>
          </div>`
        )
        .openPopup();
      layersRef.current.push(mp);
      bounds.extend([midpoint.lat, midpoint.lng]);
    }

    // Draw routes from OSRM geometry
    if (distances && distances.length > 0) {
      distances.forEach((d) => {
        if (d.geometry && d.geometry.coordinates) {
          const latlngs = d.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          const polyline = L.polyline(latlngs, {
            color: d.color,
            weight: 4,
            opacity: 0.75,
            dashArray: null,
            smoothFactor: 1,
          }).addTo(map);
          layersRef.current.push(polyline);
        }
      });
    }

    // Place markers (food/cafe)
    if (places && places.length > 0) {
      places.forEach((p) => {
        const emoji = { cafe: "☕", restaurant: "🍽️", fast_food: "🍔", bar: "🍺" };
        const pm = L.marker([p.lat, p.lon], { icon: placeIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: Inter, sans-serif;">
              <strong>${emoji[p.type] || "📍"} ${p.name}</strong><br/>
              <span style="font-size: 12px; color: #666;">${p.cuisine || p.type}</span>
            </div>`
          );
        layersRef.current.push(pm);
      });
    }

    // Tourist / Trip Idea markers
    if (touristPlaces && touristPlaces.length > 0) {
      touristPlaces.forEach((p) => {
        const tIcon = L.divIcon({
          className: "tourist-marker",
          html: `<div style="
            width: 28px; height: 28px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(99,102,241,0.5);
            display: flex; align-items: center; justify-content: center;
            font-size: 14px;
          ">${p.emoji || "📍"}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
          popupAnchor: [0, -14],
        });
        const tm = L.marker([p.lat, p.lon], { icon: tIcon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family: Inter, sans-serif;">
              <strong>${p.emoji} ${p.name}</strong><br/>
              <span style="font-size: 12px; color: #6366f1; text-transform: capitalize;">${(p.category || '').replace(/_/g, ' ')}</span><br/>
              <span style="font-size: 11px; color: #999;">${p.distKm ? p.distKm.toFixed(1) + ' km from midpoint' : ''}</span>
            </div>`
          );
        layersRef.current.push(tm);
      });
    }

    // Add user live location
    if (liveLocations && liveLocations.length > 0) {
      liveLocations.forEach((loc) => {
        const liveIcon = L.divIcon({
          className: "live-user-marker",
          html: `<div style="
            width: 16px; height: 16px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 15px rgba(59, 130, 246, 0.8), 0 2px 5px rgba(0,0,0,0.3);
            position: relative;
          ">
            <div style="
              position: absolute;
              top: -50%; left: -50%;
              width: 200%; height: 200%;
              background: rgba(59, 130, 246, 0.4);
              border-radius: 50%;
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
            "></div>
          </div>
          <style>
            @keyframes ping {
              75%, 100% {
                transform: scale(2);
                opacity: 0;
              }
            }
          </style>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        const liveMarker = L.marker([loc.lat, loc.lng], { icon: liveIcon, zIndexOffset: 1000 })
          .addTo(map)
          .bindPopup(`<strong>${loc.id === "me" ? "You are here" : "Friend is here"}</strong>`);
          
        layersRef.current.push(liveMarker);
      });
    }

    // Add Destination Marker and Path
    if (destinationData) {
      const destIcon = L.divIcon({
        className: "destination-marker",
        html: `<div style="
          width: 32px; height: 32px;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          border: 3px solid white;
          border-radius: 8px 8px 8px 0;
          transform: rotate(-45deg);
          box-shadow: 2px 2px 8px rgba(0,0,0,0.4);
          display: flex; align-items: center; justify-content: center;
        "><span style="transform: rotate(45deg); font-size: 16px;">🌟</span></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32],
      });

      const dm = L.marker([destinationData.lat, destinationData.lng], { icon: destIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-family: Inter, sans-serif;">
            <strong>🌟 Final Destination</strong><br/>
            <span style="font-size: 12px; color: #666;">${destinationData.display || destinationData.name}</span>
          </div>`
        );
      layersRef.current.push(dm);
      bounds.extend([destinationData.lat, destinationData.lng]);

      if (destinationData.geometry && destinationData.geometry.coordinates) {
        const destLatlngs = destinationData.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
        const destPolyline = L.polyline(destLatlngs, {
          color: "#8b5cf6",
          weight: 5,
          opacity: 0.9,
          dashArray: "10, 10",
        }).addTo(map);
        layersRef.current.push(destPolyline);
      }
    }

    // Fit bounds
    if (bounds.isValid() && (!liveLocations || liveLocations.length === 0)) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
    } else if (liveLocations && liveLocations.length > 0 && bounds.isValid()) {
        liveLocations.forEach(loc => bounds.extend([loc.lat, loc.lng]));
        // we don't fitbounds continuously so it doesn't interrupt dragging
    }

    // eslint-disable-next-line
  }, [coordinates, midpoint, distances, places, touristPlaces, liveLocations, destinationData]);

  return (
    <div
      ref={mapContainerRef}
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export default MapDisplay;
