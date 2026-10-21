import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, Plus, Calendar, AlertCircle, Search, Filter } from 'lucide-react';
import { api } from '../services/api';

export interface IncidentReport {
  id: string;
  userId: string;
  title: string;
  category: 'Harassment' | 'Stalking' | 'Theft' | 'Unsafe Environment' | 'Medical Emergency' | 'Other';
  incidentDate: string;
  description: string;
  location?: string;
  sosEventId?: string;
  reportedToAuthorities: boolean;
  notes?: string;
  createdAt: string;
}

export const IncidentReports: React.FC = () => {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'Harassment' | 'Stalking' | 'Theft' | 'Unsafe Environment' | 'Medical Emergency' | 'Other'>('Harassment');
  const [incidentDate, setIncidentDate] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [reportedToAuthorities, setReportedToAuthorities] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.getIncidents();
      if (res.success) {
        setReports(res.incidents || []);
      }
    } catch (e: any) {
      console.warn('Failed to load incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Title and description are required.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.createIncident({
        title,
        category,
        incidentDate,
        description,
        location,
        reportedToAuthorities,
        notes
      });
      if (res.success) {
        setShowForm(false);
        setTitle('');
        setDescription('');
        setLocation('');
        setNotes('');
        fetchReports();
      } else {
        setError(res.error || 'Failed to submit report');
      }
    } catch (err: any) {
      setError(err?.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this incident report?')) return;
    try {
      const res = await api.deleteIncident(id);
      if (res.success) {
        setReports(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadPdf = (id: string) => {
    window.open(`/api/v1/incidents/${id}/pdf`, '_blank');
  };

  const filtered = reports.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
                          r.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm md:text-base">
              Emergency Incident Reports
            </h3>
            <span className="text-[11px] text-slate-500">
              Confidential Logs & Formal PDF Export
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-lg transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          {showForm ? 'Cancel' : 'New Report'}
        </button>
      </div>

      {error && (
        <div className="p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Confidential Incident Statement
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Incident Headline</label>
              <input
                type="text"
                placeholder="Brief summary (e.g., Followed near Metro exit)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
              <select
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="Harassment">Harassment</option>
                <option value="Stalking">Stalking</option>
                <option value="Theft">Theft / Snatching</option>
                <option value="Unsafe Environment">Unsafe Environment / Poor Lighting</option>
                <option value="Medical Emergency">Medical Emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Date & Time</label>
              <input
                type="datetime-local"
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Location / Landmark</label>
              <input
                type="text"
                placeholder="Location details or coordinates"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 mb-1">Full Incident Description</label>
            <textarea
              rows={3}
              placeholder="Provide a factual summary of what occurred, involved individuals, or vehicle descriptions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={reportedToAuthorities}
                onChange={(e) => setReportedToAuthorities(e.target.checked)}
                className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span>Formally reported to Police/Security</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
            >
              {loading ? 'Saving...' : 'Save Report'}
            </button>
          </div>
        </form>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs p-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
          >
            <option value="All">All Categories</option>
            <option value="Harassment">Harassment</option>
            <option value="Stalking">Stalking</option>
            <option value="Theft">Theft</option>
            <option value="Unsafe Environment">Unsafe Environment</option>
            <option value="Medical Emergency">Medical Emergency</option>
          </select>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-medium text-slate-600">No incident reports recorded</p>
            <p className="text-xs">Create an incident log if you experience unsafe occurrences.</p>
          </div>
        ) : (
          filtered.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{report.title}</span>
                    <span className="text-[10px] bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-full">
                      {report.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(report.incidentDate).toLocaleString()}</span>
                    {report.location && <span>• 📍 {report.location}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleDownloadPdf(report.id)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg transition"
                    title="Download Official Incident PDF"
                  >
                    <Download className="w-3 h-3 text-rose-600" />
                    <span>PDF</span>
                  </button>

                  <button
                    onClick={() => handleDelete(report.id)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    title="Delete report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-slate-100">
                {report.description}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
