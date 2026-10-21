import { useState, useEffect } from 'react';
import { Phone, ExternalLink, Navigation, Search, Building2, Shield, HeartPulse } from 'lucide-react';
import { api } from '../services/api';

export interface EmergencyResource {
  id: string;
  name: string;
  type: 'police' | 'hospital' | 'helpline' | 'shelter';
  address: string;
  phone: string;
  distanceKm?: number;
  latitude: number;
  longitude: number;
  verified: boolean;
  hours: string;
}

interface EmergencyResourcesProps {
  coordinates?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null;
}

export const EmergencyResources: React.FC<EmergencyResourcesProps> = ({ coordinates }) => {
  const [resources, setResources] = useState<EmergencyResource[]>([]);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const lat = coordinates?.latitude ?? 28.6139;
      const lng = coordinates?.longitude ?? 77.2090;
      const res = await api.getNearbyResources(lat, lng, selectedType);
      if (res.success) {
        setResources(res.resources || []);
      }
    } catch (e) {
      console.warn('Failed to load emergency resources:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [selectedType, coordinates?.latitude, coordinates?.longitude]);

  const filtered = resources.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.address.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'police': return <Shield className="w-4 h-4 text-blue-600" />;
      case 'hospital': return <HeartPulse className="w-4 h-4 text-red-600" />;
      default: return <Building2 className="w-4 h-4 text-emerald-600" />;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              Nearby Emergency Resources
            </h3>
            <span className="text-[11px] text-slate-500">
              Verified Police Stations, Hospitals & Helplines
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search facility name or area..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {['all', 'police', 'hospital', 'helpline'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-xl border capitalize transition ${
                selectedType === t
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Cards */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">Loading directory...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">No emergency facilities found matching your criteria.</div>
        ) : (
          filtered.map((res) => (
            <div
              key={res.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-2xs mt-0.5">
                    {getIcon(res.type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{res.name}</span>
                      {res.verified && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">
                          Verified
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{res.address}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-600 mt-1">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <a href={`tel:${res.phone}`} className="hover:underline font-medium">{res.phone}</a>
                      </span>
                      <span>• Hours: {res.hours}</span>
                      {res.distanceKm && (
                        <span className="font-semibold text-indigo-600">• {res.distanceKm} km away</span>
                      )}
                    </div>
                  </div>
                </div>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${res.latitude},${res.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-blue-600 px-3 py-1.5 rounded-lg transition shadow-2xs shrink-0"
                >
                  <span>Directions</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px] text-slate-500 text-center">
        Data verified from National Women Helpline (1091/112) and official state emergency registries.
      </div>
    </div>
  );
};
