import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Check, X, Shield, Clock, Search, Settings, MessageSquare, Trash2, Loader2 } from 'lucide-react';

export function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState({ enabled: false, message: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminTab, setAdminTab] = useState<'users' | 'suggestions' | 'settings' | 'communities'>('users');
  const [communities, setCommunities] = useState<any[]>([]);
  const [actionState, setActionState] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: usersData, error: usersError } = await supabase
        .from('user_settings')
        .select('user_id, username, avatar_url, role, access_status, updated_at')
        .order('updated_at', { ascending: false });
      if (usersData) setUsers(usersData);

      const { data: maintData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('id', 'maintenance_mode')
        .maybeSingle();
      if (maintData) setMaintenanceMode(maintData.value);

      const { data: suggData } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });
      if (suggData) setSuggestions(suggData);

      const { data: commData, error: commError } = await supabase
        .from('communities')
        .select('*')
        .order('created_at', { ascending: false });
      if (commError) {
         console.error('Error fetching communities:', commError);
      }
      if (commData) {
        // manually attach owner username from usersData
        const commsWithOwners = commData.map(c => {
          const owner = usersData?.find(u => u.user_id === c.owner_id);
          return { ...c, owner: owner ? { username: owner.username } : null };
        });
        setCommunities(commsWithOwners);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAccess = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'approved' ? 'pending' : 'approved';
    setActionState(prev => ({ ...prev, [userId]: newStatus === 'approved' ? 'approving' : 'revoking' }));
    try {
      await supabase.from('user_settings').update({ access_status: newStatus }).eq('user_id', userId);
      setUsers(users.map(u => u.user_id === userId ? { ...u, access_status: newStatus } : u));
    } catch (err) {
      console.error("Error updating access status:", err);
    } finally {
      setActionState(prev => ({ ...prev, [userId]: '' }));
    }
  };

  const denyUser = async (userId: string) => {
    setActionState(prev => ({ ...prev, [userId]: 'denying' }));
    try {
      await supabase.from('user_settings').update({ access_status: 'denied' }).eq('user_id', userId);
      setUsers(users.map(u => u.user_id === userId ? { ...u, access_status: 'denied' } : u));
    } catch (err) {
      console.error("Error denying user:", err);
    } finally {
      setActionState(prev => ({ ...prev, [userId]: '' }));
    }
  };

  const deleteCommunity = async (commId: string) => {
    try {
      await supabase.from('communities').delete().eq('id', commId);
      setCommunities(communities.filter(c => c.id !== commId));
    } catch (err) {
      console.error("Error deleting community:", err);
    }
  };

  const toggleMaintenance = async () => {
    const newValue = { ...maintenanceMode, enabled: !maintenanceMode.enabled };
    try {
      await supabase.from('global_settings').upsert({ id: 'maintenance_mode', value: newValue });
      setMaintenanceMode(newValue);
    } catch (err) {
      console.error("Error toggling maintenance mode:", err);
    }
  };

  const updateMaintenanceMessage = async (message: string) => {
    const newValue = { ...maintenanceMode, message };
    setMaintenanceMode(newValue);
    try {
      await supabase.from('global_settings').upsert({ id: 'maintenance_mode', value: newValue });
    } catch (err) {
      console.error("Error updating maintenance message:", err);
    }
  };

  const deleteSuggestion = async (id: string) => {
    try {
      await supabase.from('suggestions').delete().eq('id', id);
      setSuggestions(suggestions.filter(s => s.id !== id));
    } catch (err) {
      console.error("Error deleting suggestion:", err);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
              <Shield className="h-6 w-6 text-amber-400" />
              Admin Panel
            </h2>
            <p className="text-slate-400 mt-1">Manage users, suggestions, and settings</p>
          </div>
          
          <div className="flex gap-2 shrink-0 overflow-x-auto custom-scrollbar pb-2 sm:pb-0">
            <button
              onClick={() => setAdminTab('users')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${adminTab === 'users' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              Users
            </button>
            <button
              onClick={() => setAdminTab('communities')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${adminTab === 'communities' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              Communities
            </button>
            <button
              onClick={() => setAdminTab('suggestions')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${adminTab === 'suggestions' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              Suggestions
            </button>
            <button
              onClick={() => setAdminTab('settings')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0 ${adminTab === 'settings' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              Settings
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">Loading data...</div>
        ) : (
          <>
            {adminTab === 'users' && (
              <>
                <div className="mb-4 relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">User</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((u) => (
                        <tr key={u.user_id} className="transition-colors hover:bg-white/5">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {u.avatar_url ? (
                                <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white uppercase">
                                  {u.username?.[0] || '?'}
                                </div>
                              )}
                              <span className="font-medium text-white">{u.username}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${u.role === 'admin' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-300'}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${u.access_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                              {u.access_status === 'approved' ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {u.access_status}
                            </span>
                          </td>
                           <td className="px-4 py-4 text-right">
                            {u.role !== 'admin' && (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onDoubleClick={() => toggleAccess(u.user_id, u.access_status)}
                                  disabled={!!actionState[u.user_id]}
                                  className={`relative overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${u.access_status === 'approved' ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} disabled:opacity-50`}
                                  title={u.access_status === 'approved' ? 'Double click to revoke' : 'Double click to approve'}
                                >
                                  {(actionState[u.user_id] === 'approving' || actionState[u.user_id] === 'revoking') ? (
                                    <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> {(actionState[u.user_id] === 'approving') ? 'Approving...' : 'Revoking...'}</span>
                                  ) : (
                                    u.access_status === 'approved' ? 'Revoke Access' : 'Approve Access'
                                  )}
                                </button>
                                {u.access_status === 'pending' && (
                                  <button
                                    onDoubleClick={() => denyUser(u.user_id)}
                                    disabled={!!actionState[u.user_id]}
                                    className="relative overflow-hidden rounded-lg px-3 py-1.5 text-xs font-medium transition-colors bg-red-600/10 text-red-500 hover:bg-red-600/20 disabled:opacity-50"
                                    title="Double click to deny"
                                  >
                                    {actionState[u.user_id] === 'denying' ? (
                                       <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Denying...</span>
                                    ) : 'Deny Request'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No users found.</div>
                  )}
                </div>
              </>
            )}

            {adminTab === 'communities' && (
              <>
                <div className="mb-4 relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search communities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/20 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 outline-none focus:border-amber-500/50"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-300">
                    <thead className="border-b border-white/10 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Community Name</th>
                        <th className="px-4 py-3 font-medium">Owner</th>
                        <th className="px-4 py-3 font-medium">Public Status</th>
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {communities.filter(c => c.name?.toLowerCase().includes(searchQuery.toLowerCase())).map((c) => (
                        <tr key={c.id} className="transition-colors hover:bg-white/5">
                          <td className="px-4 py-4">
                            <span className="font-medium text-white">{c.name}</span>
                          </td>
                          <td className="px-4 py-4 text-slate-300">
                            {c.owner?.username || 'Unknown'}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${c.is_public ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-300'}`}>
                              {c.is_public ? 'Public' : 'Private'}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              onDoubleClick={() => deleteCommunity(c.id)}
                              className="p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors border border-transparent hover:border-rose-500/30 inline-flex items-center"
                              title="Double click to delete community"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {communities.length === 0 && (
                    <div className="text-center py-8 text-slate-500">No communities found.</div>
                  )}
                </div>
              </>
            )}

            {adminTab === 'suggestions' && (
              <div className="space-y-4">
                {suggestions.map((sugg) => (
                  <div key={sugg.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageSquare className="h-4 w-4 text-amber-400" />
                        <span className="font-semibold text-white">{sugg.username}</span>
                        <span className="text-xs text-slate-500">{new Date(sugg.created_at).toLocaleString()}</span>
                      </div>
                      <button onClick={() => deleteSuggestion(sugg.id)} className="text-slate-400 hover:text-rose-400 transition-colors" title="Discard suggestion">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{sugg.message}</p>
                  </div>
                ))}
                {suggestions.length === 0 && (
                  <div className="text-center py-8 text-slate-500">No suggestions yet.</div>
                )}
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">Maintenance Mode</h3>
                      <p className="text-sm text-slate-400">Lock the app with a maintenance message</p>
                    </div>
                    <button
                      onClick={toggleMaintenance}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${maintenanceMode.enabled ? 'bg-amber-500' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${maintenanceMode.enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Maintenance Message</label>
                    <textarea
                      value={maintenanceMode.message}
                      onChange={(e) => updateMaintenanceMessage(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-500/50 min-h-[100px]"
                      placeholder="brb"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
