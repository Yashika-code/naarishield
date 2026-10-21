import React, { useState } from 'react';
import { UserPlus, Trash2, Phone, UserCheck, AlertCircle, Send, CheckCircle, Clock } from 'lucide-react';
import type { TrustedContact } from '../types';
import { api } from '../services/api';

interface ContactManagerProps {
  contacts: TrustedContact[];
  onAddContact: (contact: { name: string; phone: string; relationship?: string; priority?: number }) => Promise<void>;
  onDeleteContact: (id: string) => Promise<void>;
}

export const ContactManager: React.FC<ContactManagerProps> = ({
  contacts,
  onAddContact,
  onDeleteContact,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('Parent');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [invitationSuccess, setInvitationSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setError('Name and phone number are required.');
      return;
    }

    if (contacts.length >= 5) {
      setError('Maximum 5 emergency contacts permitted.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onAddContact({ name, phone, relationship, priority: contacts.length + 1 });
      setName('');
      setPhone('');
      setShowAddForm(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to add emergency contact');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (contactId: string, contactName: string) => {
    try {
      setInvitingId(contactId);
      const res = await api.inviteContact(contactId);
      if (res.success) {
        setInvitationSuccess(`Invitation dispatched to ${contactName}`);
        setTimeout(() => setInvitationSuccess(null), 5000);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed sending invitation');
    } finally {
      setInvitingId(null);
    }
  };

  const handleDeleteWithConfirm = async (id: string, contactName: string) => {
    if (window.confirm(`Are you sure you want to remove ${contactName} from your emergency contacts?`)) {
      await onDeleteContact(id);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-slate-700" />
          <h3 className="font-semibold text-slate-900 text-sm md:text-base">
            Trusted Emergency Contacts
          </h3>
          <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
            {contacts.length}/5
          </span>
        </div>

        {contacts.length < 5 && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {showAddForm ? 'Cancel' : 'Add Contact'}
          </button>
        )}
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        {error && (
          <div className="mb-3 p-2.5 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {invitationSuccess && (
          <div className="mb-3 p-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{invitationSuccess}</span>
          </div>
        )}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">New Emergency Contact</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Full Name (e.g. Maya Patel)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
              <input
                type="tel"
                placeholder="Mobile (+919876543210)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                required
              />
            </div>
            <div className="flex gap-2 items-center">
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="text-xs p-2 rounded-lg border border-slate-300 bg-white focus:outline-none"
              >
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Spouse">Spouse / Partner</option>
                <option value="Friend">Trusted Friend</option>
                <option value="Colleague">Colleague</option>
              </select>

              <button
                type="submit"
                disabled={loading}
                className="ml-auto text-xs bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition"
              >
                {loading ? 'Saving...' : 'Save Contact'}
              </button>
            </div>
          </form>
        )}

        {contacts.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <UserCheck className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No emergency contacts added yet.</p>
            <p className="text-xs">Add up to 5 guardians to be notified during SOS alerts.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {contacts.map((contact, index) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 hover:border-slate-300 hover:shadow-xs bg-white transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                    {contact.priority || index + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">{contact.name}</span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                        {contact.relationship}
                      </span>
                      {contact.verificationStatus === 'verified' ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-medium">
                          <CheckCircle className="w-2.5 h-2.5" /> Verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-medium">
                          <Clock className="w-2.5 h-2.5" /> Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{contact.phoneNumber || contact.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {contact.verificationStatus !== 'verified' && (
                    <button
                      onClick={() => handleSendInvite(contact.id, contact.name)}
                      disabled={invitingId === contact.id}
                      title="Send verification invitation link"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg px-2 py-1 transition"
                    >
                      <Send className="w-3 h-3" />
                      <span>{invitingId === contact.id ? 'Sending...' : 'Invite'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteWithConfirm(contact.id, contact.name)}
                    title="Remove contact"
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
        Contacts receive immediate emergency alerts with GPS maps during an SOS. Verified contacts ensure highest delivery reliability.
      </div>
    </div>
  );
};

