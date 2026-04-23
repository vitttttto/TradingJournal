import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Search, Plus, Shield, ShieldAlert, Clock, Check, X, ArrowLeft, MoreVertical, Edit2, UploadCloud, GripVertical } from 'lucide-react';
import { Reorder } from "motion/react";

const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export function Communities({ 
  user, 
  panelStyle, 
  softPanelStyle, 
  accentColor, 
  accentButtonStyle,
  panelTint,
  onNavigate
}: any) {
  const [activeView, setActiveView] = useState<'list' | 'community'>('list');
  const [selectedCommunity, setSelectedCommunity] = useState<any>(null);
  
  const [myCommunities, setMyCommunities] = useState<any[]>([]);
  const [publicCommunities, setPublicCommunities] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommIsPublic, setNewCommIsPublic] = useState(true);

  // Admin view
  const [communityMembers, setCommunityMembers] = useState<any[]>([]);
  const [communityRoles, setCommunityRoles] = useState<any[]>([]);
  const [deletedRoles, setDeletedRoles] = useState<string[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    // This will error if the user hasn't run the SQL yet, which is expected
    try {
      // My joined/owned communities
      const { data: myMemberships } = await supabase
        .from('community_members')
        .select(`
          community_id, 
          status,
          role:community_roles(name, is_system_role, permissions),
          community:communities(id, name, description, is_public, owner_id, discord_url, avatar_url)
        `)
        .eq('user_id', user.id);

      const memberships = myMemberships || [];
      
      const { data: activeMembers } = await supabase
        .from('community_members')
        .select('community_id')
        .eq('status', 'active');
        
      const counts: Record<string, number> = {};
      (activeMembers || []).forEach(m => {
        counts[m.community_id] = (counts[m.community_id] || 0) + 1;
      });

      const joined = memberships.filter(m => m.status === 'active').map(m => ({ ...m.community, my_role: m.role, memberCount: counts[m.community_id] || 0 }));
      const pending = memberships.filter(m => m.status === 'pending').map(m => m.community_id);
      
      setMyCommunities(joined);
      setPendingRequests(pending);

      // Public communities to discover
      const { data: publicComms } = await supabase
        .from('communities')
        .select('id, name, description, is_public, owner_id, discord_url, avatar_url')
        .eq('is_public', true);

      // Filter out ones we are already in or requested to be in
      const toDiscover = (publicComms || []).filter(c => 
        !joined.find((j: any) => j.id === c.id) && !pending.includes(c.id)
      ).map(c => ({
        ...c,
        memberCount: counts[c.id] || 0
      }));
      setPublicCommunities(toDiscover);
    } catch (e) {
      console.log('Ensure SQL migration is run:', e);
    }
    setIsLoading(false);
  };

  const loadCommunityDetails = async (commId: string) => {
    try {
      const { data: members, error: memErr } = await supabase
        .from('community_members')
        .select(`
          id, user_id, status, joined_at,
          role:community_roles(id, name, is_system_role, permissions)
        `)
        .eq('community_id', commId);

      if (memErr) throw memErr;

      // Extract user_ids to safely query user settings
      const userIds = members?.map(m => m.user_id) || [];
      let tempSettings: any[] = [];
      if (userIds.length > 0) {
        const { data: settings } = await supabase.from('user_settings').select('user_id, username, avatar_url').in('user_id', userIds);
        tempSettings = settings || [];
      }

      const enrichedMembers = (members || []).map(m => ({
        ...m,
        user_settings: tempSettings.filter(ts => ts.user_id === m.user_id)
      }));

      const { data: roles } = await supabase
        .from('community_roles')
        .select('*')
        .eq('community_id', commId)
        .order('created_at', { ascending: true });

      setCommunityMembers(enrichedMembers.filter(m => m.status === 'active'));
      setJoinRequests(enrichedMembers.filter(m => m.status === 'pending'));
      setCommunityRoles(roles || []);
    } catch (e) {
      console.log('Error Loading Community Details:', e);
    }
  };

  const handleCreateCommunity = async () => {
    if (!user) return;
    if (!newCommName.trim()) return;
    
    // Check if user already owns a community
    const existingOwn = myCommunities.find(c => c.owner_id === user.id);
    if (existingOwn) {
      alert("You can only create 1 community per person.");
      return;
    }

    try {
      // Create community
      const { data: newComm, error: commErr } = await supabase
        .from('communities')
        .insert({
          name: newCommName.trim(),
          description: newCommDesc.trim(),
          is_public: newCommIsPublic,
          owner_id: user.id
        }).select().single();
      
      if (commErr) throw commErr;

      // Create default roles
      const defaultRoles = [
        { community_id: newComm.id, name: 'Owner', is_system_role: true, permissions: { can_manage_roles: true, can_manage_members: true, can_manage_settings: true } },
        { community_id: newComm.id, name: 'Moderator', is_system_role: true, permissions: { can_manage_roles: true, can_manage_members: true, can_manage_settings: true } },
        { community_id: newComm.id, name: 'Member', is_system_role: true, permissions: { can_manage_roles: false, can_manage_members: false, can_manage_settings: false } }
      ];

      const { data: roles, error: rolesErr } = await supabase.from('community_roles').insert(defaultRoles).select();
      if (rolesErr) throw rolesErr;

      const ownerRole = roles.find(r => r.name === 'Owner');

      // Add self as owner member
      await supabase.from('community_members').insert({
        community_id: newComm.id,
        user_id: user.id,
        role_id: ownerRole!.id,
        status: 'active'
      });

      setShowCreateModal(false);
      setNewCommName('');
      setNewCommDesc('');
      loadData();
    } catch (e: any) {
      alert("Error creating community: " + e.message);
    }
  };

  const handleRequestJoin = async (commId: string) => {
    if (!user) return;
    try {
      await supabase.from('community_members').insert({
        community_id: commId,
        user_id: user.id,
        status: 'pending' // need owner/mod to accept
      });
      loadData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleApproveRequest = async (memberId: string, communityId: string) => {
    const memberRole = communityRoles.find(r => r.name === 'Member');
    await supabase.from('community_members').update({
      status: 'active',
      role_id: memberRole?.id
    }).eq('id', memberId);
    loadCommunityDetails(communityId);
  };

  const handleDenyRequest = async (memberId: string, communityId: string) => {
    await supabase.from('community_members').delete().eq('id', memberId);
    loadCommunityDetails(communityId);
  };

  const isOwner = selectedCommunity?.owner_id === user?.id;
  const isModOrOwner = isOwner || selectedCommunity?.my_role?.permissions?.can_manage_members;

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editCommName, setEditCommName] = useState('');
  const [editCommDesc, setEditCommDesc] = useState('');
  const [editCommDiscord, setEditCommDiscord] = useState('');
  const [editCommIsPublic, setEditCommIsPublic] = useState(true);
  const [editCommAvatar, setEditCommAvatar] = useState('');
  const [editRoles, setEditRoles] = useState<any[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [showNoDiscordModal, setShowNoDiscordModal] = useState(false);

  const handleOpenSettings = () => {
    setEditCommName(selectedCommunity.name);
    setEditCommDesc(selectedCommunity.description || '');
    setEditCommDiscord(selectedCommunity.discord_url || '');
    setEditCommIsPublic(selectedCommunity.is_public);
    setEditCommAvatar(selectedCommunity.avatar_url || '');
    setEditRoles(communityRoles.map(r => ({ ...r }))); // deep copy
    setDeletedRoles([]);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async () => {
    try {
      setIsSavingSettings(true);
      if (isModOrOwner) {
        await supabase.from('communities').update({
          name: editCommName,
          description: editCommDesc,
          discord_url: editCommDiscord,
          is_public: editCommIsPublic,
          avatar_url: editCommAvatar
        }).eq('id', selectedCommunity.id);
      }

      // Update names and order of roles
      for (let i = 0; i < editRoles.length; i++) {
        const role = editRoles[i];
        if (role.id) {
          await supabase.from('community_roles').update({ 
            name: role.name,
            permissions: { ...(role.permissions || {}), order: i }
          }).eq('id', role.id);
        } else {
          // It's a new role
          await supabase.from('community_roles').insert({
            community_id: selectedCommunity.id,
            name: role.name,
            permissions: { can_manage_roles: false, can_manage_members: false, can_manage_settings: false, order: i },
            is_system_role: false
          });
        }
      }

      if (deletedRoles.length > 0) {
        await supabase.from('community_roles').delete().in('id', deletedRoles);
      }

      setSettingsSaved(true);
      setSelectedCommunity({
        ...selectedCommunity,
        name: editCommName,
        description: editCommDesc,
        discord_url: editCommDiscord,
        is_public: editCommIsPublic,
        avatar_url: editCommAvatar
      });
      setTimeout(() => {
        setSettingsSaved(false);
        setShowSettingsModal(false);
        loadCommunityDetails(selectedCommunity.id);
        loadData(); // reload list
      }, 1500);
      
    } catch (e: any) {
      alert("Error saving settings: " + e.message);
      setIsSavingSettings(false);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, roleId: string) => {
    await supabase.from('community_members').update({ role_id: roleId }).eq('id', memberId);
    loadCommunityDetails(selectedCommunity.id);
  };

  const handleKickMember = async (memberId: string, memberRole: any) => {
    if (memberRole?.name === 'Owner') {
      alert("You cannot kick the Owner.");
      return;
    }
    if (!isOwner && memberRole?.permissions?.can_manage_members) {
      alert("Moderators cannot kick other Moderators.");
      return;
    }
    await supabase.from('community_members').delete().eq('id', memberId);
    loadCommunityDetails(selectedCommunity.id);
  };

  const handleLeaveCommunity = async () => {
    if (!window.confirm("Are you sure you want to leave this community?")) return;
    const myMembership = communityMembers.find(m => m.user_id === user?.id);
    if (myMembership) {
      await supabase.from('community_members').delete().eq('id', myMembership.id);
      setActiveView('list');
      loadData();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Image is too large. Please use a file smaller than 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setEditCommAvatar(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDeleteCommunity = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this community?")) return;
    await supabase.from('communities').delete().eq('id', selectedCommunity.id);
    setActiveView('list');
    loadData();
  };

  const handleAddRole = () => {
    if (editRoles.length >= 5) {
      alert("Maximum 5 roles allowed.");
      return;
    }
    if (!newRoleName.trim()) return;
    setEditRoles([...editRoles, { id: null, name: newRoleName.trim(), is_system_role: false }]);
    setNewRoleName('');
  };

  const handleDeleteRole = (role: any, idx: number) => {
    if (role.is_system_role) {
      alert("System roles cannot be deleted.");
      return;
    }
    const newRoles = [...editRoles];
    const removed = newRoles.splice(idx, 1);
    setEditRoles(newRoles);
    if (removed[0].id) {
       setDeletedRoles((prev) => [...prev, removed[0].id]);
    }
  };

  if (activeView === 'community' && selectedCommunity) {
    const isModOrOwner = selectedCommunity.my_role?.permissions?.can_manage_settings;

    return (
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
        <button
          onClick={() => setActiveView('list')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Communities
        </button>

        <div className="rounded-3xl border p-6 lg:p-8" style={panelStyle}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {selectedCommunity.avatar_url ? (
                <img src={selectedCommunity.avatar_url} alt="" className="h-16 w-16 rounded-2xl object-cover border border-white/10" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/10 text-xl font-bold text-white uppercase">
                  {selectedCommunity.name.substring(0, 2)}
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold text-white">{selectedCommunity.name}</h2>
                <p className="text-sm text-slate-400 mt-1">{selectedCommunity.description || "No description provided."}</p>
              </div>
            </div>
            
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedCommunity.discord_url) {
                      window.open(selectedCommunity.discord_url, "_blank");
                    } else {
                      setShowNoDiscordModal(true);
                    }
                  }}
                  className="px-3 py-2 bg-[#5865F2]/10 text-[#5865F2] border border-[#5865F2]/20 rounded-xl text-sm font-semibold hover:bg-[#5865F2]/20 transition-colors flex items-center justify-center shrink-0"
                  title="Discord"
                >
                  <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-current"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
                </button>
              {isModOrOwner && (
                <button 
                  onClick={handleOpenSettings}
                  className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-semibold text-slate-300 hover:bg-white/10 transition-colors"
                >
                  <Edit2 className="h-4 w-4 inline mr-2 hidden sm:inline" />
                  Edit Settings
                </button>
              )}
              {isOwner ? (
                <button 
                  onClick={handleDeleteCommunity}
                  className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-semibold hover:bg-rose-500/20 transition-colors"
                >
                  Delete Community
                </button>
              ) : (
                <button 
                  onClick={handleLeaveCommunity}
                  className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-sm font-semibold hover:bg-rose-500/20 transition-colors"
                >
                  Leave Community
                </button>
              )}
            </div>
          </div>

          {isModOrOwner && joinRequests.length > 0 && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-white mb-4">Pending Requests ({joinRequests.length})</h3>
              <div className="grid gap-3">
                {joinRequests.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-4 rounded-2xl border" style={softPanelStyle}>
                    <div className="flex items-center gap-3">
                      <img src={req.user_settings?.[0]?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + req.user_id} className="w-10 h-10 rounded-full bg-slate-800" alt="avatar" />
                      <div>
                        <div className="font-semibold text-white">{req.user_settings?.[0]?.username || 'Unknown User'}</div>
                        <div className="text-xs text-slate-400">Wants to join</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleApproveRequest(req.id, selectedCommunity.id)} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30">
                        <Check className="h-4 w-4" />
                      </button>
                      <button onClick={() => handleDenyRequest(req.id, selectedCommunity.id)} className="p-2 bg-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-500/30">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 space-y-8">
            <h3 className="text-lg font-semibold text-white mb-4">Members ({communityMembers.length})</h3>
            
            {Array.from(new Set(communityMembers.map(m => m.role?.name || 'Member')))
              .sort((a, b) => {
                const aOrder = communityRoles.find(r => r.name === a)?.permissions?.order ?? 99;
                const bOrder = communityRoles.find(r => r.name === b)?.permissions?.order ?? 99;
                return aOrder - bOrder;
              })
              .map(roleName => {
                const groupMembers = communityMembers.filter(m => (m.role?.name || 'Member') === roleName);
                if (groupMembers.length === 0) return null;
                return (
                  <div key={roleName}>
                    <h4 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">{roleName} — {groupMembers.length}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupMembers.map(member => (
                        <div key={member.id} className="flex flex-col gap-3 p-4 rounded-2xl border transition-all hover:bg-white/5" style={softPanelStyle} >
                          <div className="flex items-center justify-between">
                            <div className={`flex items-center gap-3 ${member.user_id !== user?.id ? 'cursor-pointer' : ''}`} onClick={() => {
                              console.log("Communities.tsx: Member clicked!", member.user_id);
                              if (member.user_id !== user?.id && onNavigate) {
                                console.log("Communities.tsx: Navigating to friends for", member.user_id);
                                onNavigate("friends", member.user_id);
                              }
                            }}>
                              <img src={member.user_settings?.[0]?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + member.user_id} className="w-10 h-10 rounded-full bg-slate-800" alt="avatar" />
                              <div className="flex flex-col">
                                <span className="font-semibold text-white">{member.user_settings?.[0]?.username || 'User'}</span>
                                {member.user_id === user?.id && <span className="text-[10px] text-emerald-400 font-medium">You</span>}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {isModOrOwner && member.user_id !== user?.id && member.role?.name !== 'Owner' && (
                                <button
                                  onDoubleClick={() => handleKickMember(member.id, member.role)}
                                  title="Double click to kick"
                                  className="p-1.5 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-colors border border-transparent hover:border-rose-500/30"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {isModOrOwner && member.user_id !== user?.id && member.role?.name !== 'Owner' && (
                            <select
                              value={member.role?.id}
                              onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                              className="w-full bg-black/20 text-xs text-slate-300 rounded-lg border border-white/5 px-2 py-1.5 outline-none hover:border-white/20 transition-colors"
                            >
                              {communityRoles.filter(r => r.name !== 'Owner').map(role => (
                                <option key={role.id} value={role.id} className="bg-slate-800 text-white">{role.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
            })}
          </div>
        </div>

        {showNoDiscordModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <div className="absolute inset-0" onClick={() => setShowNoDiscordModal(false)} />
          <div className="w-full max-w-sm rounded-3xl border p-6 shadow-2xl relative text-center" style={panelStyle}>
            <button onClick={() => setShowNoDiscordModal(false)} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
            <div className="w-16 h-16 rounded-full bg-[#5865F2]/10 flex items-center justify-center mx-auto mb-4 border border-[#5865F2]/20">
              <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 fill-[#5865F2]"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Discord Server</h3>
            <p className="text-sm text-slate-400 mb-6">This community hasn't linked a Discord server yet.</p>
            <button
              onClick={() => setShowNoDiscordModal(false)}
              className="w-full py-3 bg-white/5 border border-white/10 text-white font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showSettingsModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md bg-black/40" onClick={() => setShowSettingsModal(false)}>
            <div className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar relative modal-pop" style={panelStyle} onClick={e => e.stopPropagation()}>
              <button onClick={() => setShowSettingsModal(false)} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-xl font-bold text-white mb-6">Community Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Community Picture</label>
                  <label 
                    className="flex items-center justify-center w-full h-32 px-4 transition bg-white/5 border-2 border-white/10 border-dashed rounded-2xl appearance-none cursor-pointer hover:border-emerald-500/50 focus:outline-none"
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleImageUpload({ target: { files: e.dataTransfer.files } } as any);
                      }
                    }}
                  >
                    <div className="flex flex-row items-center space-x-6">
                      {editCommAvatar ? (
                           <img src={editCommAvatar} alt="Community Avatar" className="w-16 h-16 rounded-2xl object-cover shrink-0" />
                      ) : null }
                      <div className="flex flex-col items-center">
                        <UploadCloud className="w-6 h-6 text-slate-400 mb-2" />
                        <span className="font-medium text-slate-300 text-sm">
                          Drop image to attach, or <span className="text-emerald-400 underline">browse</span>
                        </span>
                      </div>
                    </div>
                    <input type="file" name="file_upload" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Community Name</label>
                  <input
                    type="text"
                    value={editCommName}
                    onChange={(e) => setEditCommName(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Description</label>
                  <textarea
                    value={editCommDesc}
                    onChange={(e) => setEditCommDesc(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-1.5">Discord Community Link</label>
                  <input
                    type="url"
                    placeholder="https://discord.gg/..."
                    value={editCommDiscord}
                    onChange={(e) => setEditCommDiscord(e.target.value)}
                    className="w-full rounded-xl border border-[#5865F2]/30 bg-white/5 px-4 py-3 text-sm text-white focus:border-[#5865F2] focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                  />
                </div>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                  <input
                    type="checkbox"
                    checked={editCommIsPublic}
                    onChange={(e) => setEditCommIsPublic(e.target.checked)}
                    className="accent-emerald-500 w-4 h-4"
                  />
                  <div>
                    <div className="text-sm font-semibold text-white">Public Community</div>
                    <div className="text-xs text-slate-400">Anyone can see and request to join.</div>
                  </div>
                </label>

                <div className="border-t border-white/10 pt-4 mt-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Roles & Hierarchy (Max 5)</h4>
                  <div className="space-y-3">
                    <Reorder.Group axis="y" values={editRoles} onReorder={setEditRoles} className="space-y-3">
                      {editRoles.map((role, idx) => (
                        <Reorder.Item key={role.id || role.name} value={role} className="flex items-center gap-2 touch-none">
                          <GripVertical className="h-5 w-5 text-slate-500 cursor-grab active:cursor-grabbing" />
                          <input 
                            type="text"
                            value={role.name}
                            onChange={(e) => {
                              const newRoles = [...editRoles];
                              const rIndex = newRoles.findIndex(r => (r.id || r.name) === (role.id || role.name));
                              if (rIndex !== -1) {
                                newRoles[rIndex] = { ...newRoles[rIndex], name: e.target.value };
                                setEditRoles(newRoles);
                              }
                            }}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                          />
                          {role.is_system_role ? (
                             <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-800 text-slate-300">System</span>
                          ) : (
                             <button onClick={() => handleDeleteRole(role, idx)} className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-xl">
                               <X className="h-4 w-4" />
                             </button>
                          )}
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                    {editRoles.length < 5 && (
                      <div className="flex items-center gap-2 mt-2 ml-7">
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="New Role Name"
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        />
                        <button onClick={handleAddRole} className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
              <button
                onClick={handleSaveSettings}
                disabled={isSavingSettings}
                className="mt-6 w-full relative flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white overflow-hidden"
                style={accentButtonStyle}
              >
                <div className={`transition-transform duration-300 flex items-center gap-2 ${settingsSaved ? '-translate-y-10' : 'translate-y-0'}`}>
                  <Check className="h-5 w-5" /> Save Changes
                </div>
                <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${settingsSaved ? 'translate-y-0' : 'translate-y-10'}`}>
                  <Check className="h-5 w-5" />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Users className="h-6 w-6 text-emerald-400" />
          Communities
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
          style={accentButtonStyle}
        >
          <Plus className="h-4 w-4" /> Create Community
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Communities */}
        <div className="rounded-3xl border p-6" style={panelStyle}>
          <h3 className="text-lg font-semibold text-white mb-4">My Communities</h3>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : myCommunities.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border border-dashed border-white/10 rounded-2xl">
              You aren't in any communities yet.
            </div>
          ) : (
            <div className="space-y-3">
              {myCommunities.map(c => (
                <div 
                  key={c.id} 
                  onClick={() => {
                    setSelectedCommunity(c);
                    setActiveView('community');
                    loadCommunityDetails(c.id);
                  }}
                  className="flex items-center justify-between p-4 rounded-2xl border transition-all hover:bg-white/5 hover:scale-[1.01] cursor-pointer" 
                  style={softPanelStyle}
                >
                  <div className="flex items-center gap-4">
                    {c.avatar_url ? (
                      <div className="w-12 h-12 rounded-xl border border-white/10 shrink-0 overflow-hidden">
                        <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                        <Users className="h-5 w-5 text-emerald-400/50" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-white">{c.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-emerald-400 font-medium">{c.my_role?.name || 'Member'}</p>
                        <span className="text-xs text-white/20">•</span>
                        <p className="text-xs text-slate-400">{c.memberCount || 0} {c.memberCount === 1 ? 'member' : 'members'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                    <ArrowLeft className="h-4 w-4 rotate-180 text-emerald-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Public Communities */}
        <div className="rounded-3xl border p-6" style={panelStyle}>
          <h3 className="text-lg font-semibold text-white mb-4">Discover Public Communities</h3>
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : publicCommunities.length === 0 && pendingRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border border-dashed border-white/10 rounded-2xl">
              No public communities available to join.
            </div>
          ) : (
            <div className="space-y-3">
              {publicCommunities.map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl border" style={softPanelStyle}>
                  <div className="flex items-center gap-4">
                    {c.avatar_url ? (
                      <div className="w-12 h-12 rounded-xl border border-white/10 shrink-0 overflow-hidden">
                        <img src={c.avatar_url} alt={c.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                        <Users className="h-5 w-5 text-emerald-400/50" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-semibold text-white">{c.name}</h4>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{c.description || 'No description'}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{c.memberCount || 0} {c.memberCount === 1 ? 'member' : 'members'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRequestJoin(c.id)}
                    className="px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-semibold rounded-xl text-sm transition-colors"
                  >
                    Request Access
                  </button>
                </div>
              ))}
              {pendingRequests.map(id => (
                <div key={id} className="flex items-center justify-between p-4 rounded-2xl border opacity-60" style={softPanelStyle}>
                  <div>
                    <h4 className="font-semibold text-white">Pending Approval</h4>
                    <p className="text-xs text-slate-400 mt-1">Community ID: {id.slice(0,8)}...</p>
                  </div>
                  <div className="px-4 py-2 bg-white/5 text-slate-400 font-semibold rounded-xl text-sm flex items-center gap-2">
                    <Clock className="h-3 w-3" /> Requested
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 backdrop-blur-md bg-black/40">
          <div className="absolute inset-0" onClick={() => setShowCreateModal(false)} />
          <div className="w-full max-w-md rounded-3xl border p-6 shadow-2xl relative" style={panelStyle}>
            <button onClick={() => setShowCreateModal(false)} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
            <h3 className="text-xl font-bold text-white mb-6">Create Community</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Community Name</label>
                <input
                  type="text"
                  value={newCommName}
                  onChange={(e) => setNewCommName(e.target.value)}
                  placeholder="e.g. Scalpers Club"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-1.5">Description (Optional)</label>
                <textarea
                  value={newCommDesc}
                  onChange={(e) => setNewCommDesc(e.target.value)}
                  placeholder="What's this community about?"
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={newCommIsPublic}
                  onChange={(e) => setNewCommIsPublic(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4"
                />
                <div>
                  <div className="text-sm font-semibold text-white">Public Community</div>
                  <div className="text-xs text-slate-400">Anyone can see and request to join.</div>
                </div>
              </label>
            </div>
            <button
              onClick={handleCreateCommunity}
              disabled={!newCommName.trim()}
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
              style={accentButtonStyle}
            >
              <Plus className="h-5 w-5" /> Create Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
