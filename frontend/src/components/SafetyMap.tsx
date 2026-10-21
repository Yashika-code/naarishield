import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, Navigation, AlertCircle } from 'lucide-react';

interface SafetyMapProps {
  coordinates: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
  locationStatus: 'available' | 'denied' | 'requesting' | 'unavailable';
  onRequestLocation: () => void;
  isSimulated?: boolean;
}

export const SafetyMap: React.FC<SafetyMapProps> = ({
  coordinates,
  locationStatus,
  onRequestLocation,
  isSimulated = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.CircleMarker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const defaultLat = coordinates ? coordinates.latitude : 28.6139;
    const defaultLng = coordinates ? coordinates.longitude : 77.2090;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], coordinates ? 15 : 13);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (coordinates) {
      map.setView([coordinates.latitude, coordinates.longitude], 15);

      if (markerRef.current) {
        markerRef.current.setLatLng([coordinates.latitude, coordinates.longitude]);
      } else {
        markerRef.current = L.circleMarker([coordinates.latitude, coordinates.longitude], {
          radius: 10,
          fillColor: '#EF4444',
          color: '#FFFFFF',
          weight: 3,
          opacity: 1,
          fillOpacity: 0.9,
        }).addTo(map);
      }

      if (coordinates.accuracy) {
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([coordinates.latitude, coordinates.longitude]);
          accuracyCircleRef.current.setRadius(coordinates.accuracy);
        } else {
          accuracyCircleRef.current = L.circle([coordinates.latitude, coordinates.longitude], {
            radius: coordinates.accuracy,
            color: '#EF4444',
            fillColor: '#EF4444',
            fillOpacity: 0.15,
            weight: 1,
          }).addTo(map);
        }
      }
    }

    return () => {
      // Keep map instance mounted across renders
    };
  }, [coordinates]);

  const googleMapsUrl = coordinates
    ? `https://www.google.com/maps?q=${coordinates.latitude},${coordinates.longitude}`
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-slate-700" />
          <h3 className="font-semibold text-slate-900 text-sm md:text-base">Live Safety Map</h3>
          {isSimulated && (
            <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-full font-medium">
              Demo Location
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Open in Maps <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            onClick={onRequestLocation}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md transition font-medium"
          >
            Refresh GPS
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-[260px] bg-slate-100">
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {locationStatus === 'denied' && (
          <div className="absolute inset-x-4 top-4 z-[1000] bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 flex items-start gap-2 shadow-sm">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Location Access Denied</p>
              <p>Please enable browser location permissions so trusted emergency contacts receive your live coordinates during alerts.</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex justify-between items-center">
        <span>
          {coordinates ? (
            `Lat: ${coordinates.latitude.toFixed(4)}, Long: ${coordinates.longitude.toFixed(4)} (±${coordinates.accuracy || 10}m)`
          ) : (
            'Coordinates pending browser GPS permission'
          )}
        </span>
        <span className="text-[11px] text-slate-400">
          Client Geolocation API
        </span>
      </div>
    </div>
  );
};
