import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, UserPlus, Check, X, ArrowLeft, TrendingUp, TrendingDown, Calendar as CalendarIcon, Image as ImageIcon, Eye, UserMinus, BookOpen, Loader2 } from 'lucide-react';
import { TradeRecord } from '../mockData';
import { normalizeSymbol } from '../App';
import { ConfirmModal } from './ConfirmModal';
import { TradeJournal } from './TradeJournal';
import { getTradeStatus, toDayKey, getTradingSession, getSessionTagStyle, getNetPnl } from '../App';

// Reusing some utility functions from App.tsx logic
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const formatSignedCurrency = (val: number) => {
  const isNegative = val < 0;
  const abs = Math.abs(val);
  return `${isNegative ? "-" : "+"}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const DoubleClickRemoveFriend = ({ friend, onRemove }: { friend: any, onRemove: (id: string) => void }) => {
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    if (clicks === 1) {
      const timer = setTimeout(() => setClicks(0), 3000); // reset after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [clicks]);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (clicks === 0) {
          setClicks(1);
        } else {
          onRemove(friend.id);
          setClicks(0);
        }
      }}
      className={`p-2 rounded-xl transition-all flex items-center justify-center ${clicks === 1 ? 'bg-rose-500 text-white w-auto px-3 gap-2' : 'bg-white/5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'}`}
    >
      <UserMinus className="h-4 w-4" />
      {clicks === 1 && <span className="text-xs font-semibold whitespace-nowrap">Click to confirm</span>}
    </button>
  );
};

export function Friends({ 
  user, 
  panelStyle, 
  softPanelStyle, 
  accentColor, 
  accentButtonStyle,
  panelTint,
  onThemeChange,
  viewUserId,
  setViewUserId,
  isModal
}: any) {
  const [activeView, setActiveView] = useState<'list' | 'friend'>('list');
  const [selectedFriend, setSelectedFriend] = useState<any>(null);
  const [friendTrades, setFriendTrades] = useState<TradeRecord[]>([]);
  const [selectedFriendDay, setSelectedFriendDay] = useState<number | null>(null);
  const [selectedFriendTrade, setSelectedFriendTrade] = useState<TradeRecord | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [friendsOfFriend, setFriendsOfFriend] = useState<any[]>([]);
  const [friendCommunities, setFriendCommunities] = useState<any[]>([]);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  
  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [recentFriendTrades, setRecentFriendTrades] = useState<any[]>([]);
  
  const [searchUsername, setSearchUsername] = useState('');
  const [searchMessage, setSearchMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [leaderboardLimit, setLeaderboardLimit] = useState<number>(5);

  const [friendToRemove, setFriendToRemove] = useState<any | null>(null);
  const [friendAnimState, setFriendAnimState] = useState(false);

  useEffect(() => {
    if (user) {
      loadFriendsAndRequests();
    }
  }, [user]);

  useEffect(() => {
    if (viewUserId) {
      handleViewUserId(viewUserId);
    }
  }, [viewUserId]);

  const handleViewUserId = async (id: string) => {
    console.log("Friends.tsx: handleViewUserId called with id", id);
    if (id === user?.id) {
      console.log("Friends.tsx: ID matched user.id, returning early");
      return;
    }
    try {
      console.log("Friends.tsx: Fetching user settings for", id);
      const { data: friendUser } = await supabase.from('user_settings').select('user_id, username, avatar_url, full_name, friends_private, friends_share_details').eq('user_id', id).maybeSingle();
      console.log("Friends.tsx: Settings result:", friendUser);
      if (friendUser) {
        viewFriend({ id: friendUser.user_id, username: friendUser.username, avatar_url: friendUser.avatar_url, full_name: friendUser.full_name, ...friendUser });
      } else {
        // Find if we have them in friendships to get their details, otherwise fallback
        console.log("Friends.tsx: User has no settings, falling back");
        viewFriend({ id: id, username: 'User' });
      }
    } catch (err) {
      console.error("Friends.tsx: Error in handleViewUserId", err);
    }
  };

  const loadFriendsAndRequests = async () => {
    if (!user) return;
    
    // Load all my relationships (people I follow, people who follow me)
    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);
      
    if (friendships) {
      const userIds = new Set<string>();
      friendships.forEach(f => {
        if (f.user_id !== user.id) userIds.add(f.user_id);
        if (f.friend_id !== user.id) userIds.add(f.friend_id);
      });

      const { data: settings } = await supabase
        .from('user_settings')
        .select('user_id, username, avatar_url')
        .in('user_id', Array.from(userIds));

      const userMap: Record<string, {username: string, avatar_url: string | null}> = {};
      if (settings) {
        settings.forEach(s => userMap[s.user_id] = { username: s.username || 'Unknown', avatar_url: s.avatar_url });
      }

      // I follow them
      const following = friendships.filter(f => f.user_id === user.id && f.status === 'accepted');
      // They follow me
      const followers = friendships.filter(f => f.friend_id === user.id && f.status === 'accepted');
      
      const mutualIds = new Set(following.filter(f => followers.some(fl => fl.user_id === f.friend_id)).map(f => f.friend_id));
      
      const myFriends = Array.from(userIds).filter(id => following.some(f => f.friend_id === id) || followers.some(f => f.user_id === id)).map(id => {
         return {
           id,
           username: userMap[id]?.username || 'Unknown',
           avatar_url: userMap[id]?.avatar_url,
           iFollowThem: following.some(f => f.friend_id === id),
           theyFollowMe: followers.some(f => f.user_id === id),
           isMutual: mutualIds.has(id)
         };
      });
      // Sort: mutuals first, then people I follow, then followers
      myFriends.sort((a, b) => {
        if (a.isMutual && !b.isMutual) return -1;
        if (!a.isMutual && b.isMutual) return 1;
        if (a.iFollowThem && !b.iFollowThem) return -1;
        if (!a.iFollowThem && b.iFollowThem) return 1;
        return 0;
      });

      setFriends(myFriends);
      
      const pending = friendships.filter(f => f.status === 'pending' && f.friend_id === user?.id).map(f => {
        return { request_id: f.id, id: f.user_id, username: userMap[f.user_id]?.username || 'Unknown', avatar_url: userMap[f.user_id]?.avatar_url };
      });
      setRequests(pending);
      
      loadLeaderboard(myFriends.filter(f => f.iFollowThem || f.theyFollowMe));
    }
  };

  const loadLeaderboard = async (friendList: any[]) => {
    if (!user) return;
    const friendIds = friendList.map(f => f.id);
    const userIds = [user.id, ...friendIds];
    
    // Get current month start and end
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    
    const { data: trades } = await supabase
      .from('trades_v2')
      .select('user_id, pnl')
      .in('user_id', userIds)
      .gte('sold_timestamp', startOfMonth)
      .lte('sold_timestamp', endOfMonth);
      
    if (trades) {
      const pnlMap: Record<string, number> = {};
      userIds.forEach(id => pnlMap[id] = 0);
      
      trades.forEach(t => {
        pnlMap[t.user_id] += Number(t.pnl);
      });
      
      // Also need to get my own username and avatar
      const { data: mySettings } = await supabase.from('user_settings').select('username, avatar_url').eq('user_id', user.id).maybeSingle();
      const myUsername = mySettings?.username || user.user_metadata?.full_name || 'Me';
      const myAvatar = mySettings?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture;
      
      const board = userIds.map(id => {
        let name = '';
        let avatar_url = null;
        if (id === user?.id) {
          name = myUsername;
          avatar_url = myAvatar;
        } else {
          const f = friendList.find(x => x.id === id);
          name = f?.username || f?.full_name || 'Unknown';
          avatar_url = f?.avatar_url;
        }
        return { id, name, avatar_url, pnl: pnlMap[id] };
      }).sort((a, b) => b.pnl - a.pnl);
      
      setLeaderboard(board);
    }
    
    if (friendIds.length > 0) {
      const { data: recentTrades } = await supabase
        .from('trades_v2')
        .select('*')
        .in('user_id', friendIds)
        .order('sold_timestamp', { ascending: false })
        .limit(5);
        
      if (recentTrades) {
         const mapped = recentTrades.map(t => {
             const f = friendList.find(x => x.id === t.user_id);
             return { ...t, friendName: f?.username || f?.full_name || 'Unknown', friendAvatar: f?.avatar_url };
         });
         setRecentFriendTrades(mapped);
      }
    }
  };

  const handleAddFriend = async () => {
    if (!searchUsername.trim()) return;
    setIsLoading(true);
    setSearchMessage('');
    
    try {
      // Find user by username
      const { data: targetUser } = await supabase
        .from('user_settings')
        .select('user_id, username, friends_private')
        .ilike('username', searchUsername)
        .maybeSingle();
        
      if (!targetUser) {
        setSearchMessage('User not found.');
        return;
      }
      
      if (targetUser.user_id === user?.id) {
        setSearchMessage('You cannot follow yourself.');
        return;
      }
      
      // Check if I already follow them
      const { data: myFollow } = await supabase
        .from('friendships')
        .select('*')
        .eq('user_id', user.id)
        .eq('friend_id', targetUser.user_id)
        .maybeSingle();
        
      if (myFollow) {
         if (myFollow.status === 'accepted') {
            setSearchMessage('You are already following them.');
         } else {
            setSearchMessage('Follow request already sent.');
         }
         return;
      }
      
      // Send follow
      const status = targetUser.friends_private ? 'pending' : 'accepted';
      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: user.id, friend_id: targetUser.user_id, status });
        
      if (error) throw error;
      setSearchMessage(status === 'pending' ? 'Follow request sent!' : 'Followed!');
      setSearchUsername('');
      loadFriendsAndRequests();
    } catch (err: any) {
      console.error(err);
      setSearchMessage('Error sending follow.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', requestId);
    loadFriendsAndRequests();
  };

  const handleRejectRequest = async (requestId: string) => {
    await supabase.from('friendships').delete().eq('id', requestId);
    loadFriendsAndRequests();
  };

  const handleFollowBack = async (friendId: string) => {
    // Check if they are private
    const { data: targetUser } = await supabase.from('user_settings').select('friends_private').eq('user_id', friendId).maybeSingle();
    const status = targetUser?.friends_private ? 'pending' : 'accepted';
    await supabase.from('friendships').insert({ user_id: user.id, friend_id: friendId, status });
    loadFriendsAndRequests();
  };

  const removeFriend = async (friendId: string) => {
    try {
      await supabase
        .from('friendships')
        .delete()
        .eq('user_id', user.id)
        .eq('friend_id', friendId);
      
      setFriends(prev => prev.filter(f => f.id !== friendId));
      setActiveView('list');
      if (onThemeChange) onThemeChange(null);
    } catch (err) {
      console.error(err);
    }
  };

  const sendQuickFriendRequest = async (targetId: string) => {
    try {
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${user.id})`)
        .maybeSingle();
        
      if (existing) {
        alert(existing.status === 'accepted' ? 'Already friends.' : 'Request already pending.');
        return;
      }
      
      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: user.id, friend_id: targetId, status: 'pending' });
        
      if (error) throw error;
      setFriendAnimState(true);
      setTimeout(() => setFriendAnimState(false), 2000);
      loadFriendsAndRequests();
    } catch (err) {
      console.error(err);
      alert("Failed to send request.");
    }
  };

  const viewFriend = async (friend: any) => {
    console.log("Friends.tsx: viewFriend called with", friend);
    setIsLoading(true);
    // When we open a new friend, reset to default profile view, especially important for modals
    setActiveView('friend');

    const fallbackAvatar = friend.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${friend.id}`;
    let friendObj = { 
       ...friend, 
       username: friend.username || 'User',
       avatar_url: fallbackAvatar
    };
    setSelectedFriend(friendObj);
    
    try {
      console.log("Friends.tsx: Fetching settings, trades, and communities in parallel...");

      // Execute main requests in parallel
      const [
        { data: settings },
        { data: tradesData },
        { data: myComms },
        { data: theirCommunities }
      ] = await Promise.all([
        supabase.from('user_settings').select('*').eq('user_id', friend.id).maybeSingle(),
        supabase.from('trades_v2').select('*').eq('user_id', friend.id).order('sold_timestamp', { ascending: false }),
        supabase.from('community_members').select('community_id').eq('status', 'active').eq('user_id', user?.id),
        supabase.from('community_members').select('community_id, communities(id, name, avatar_url)').eq('status', 'active').eq('user_id', friend.id)
      ]);

      if (onThemeChange) {
        onThemeChange(settings || null);
      }

      friendObj = {
        ...friendObj,
        settings: settings || {},
        username: settings?.username || friendObj.username,
        full_name: settings?.full_name || friendObj.full_name,
        avatar_url: settings?.avatar_url || friendObj.avatar_url,
      };
      setSelectedFriend(friendObj);
      
      console.log("Friends.tsx: Trades fetched:", tradesData?.length || 0);
      if (tradesData) {
        const canSeeDetails = settings?.friends_share_details === true;
        const mapped = tradesData.map(t => ({
          id: t.id,
          symbol: normalizeSymbol(t.symbol),
          qty: Number(t.qty),
          buyPrice: Number(t.buy_price),
          sellPrice: Number(t.sell_price),
          pnl: Number(t.pnl),
          boughtTimestamp: Number(t.bought_timestamp),
          soldTimestamp: Number(t.sold_timestamp),
          direction: t.direction,
          images: t.images || [],
          ...(canSeeDetails && {
            confluence: t.confluence || [],
            mistake: t.mistake || [],
            session: t.session || [],
            entry: t.entry || [],
            notes: t.notes || "",
            maxPointsProfit: t.max_points_profit ? Number(t.max_points_profit) : undefined,
            commission: t.commission ? Number(t.commission) : undefined,
          })
        })) as unknown as TradeRecord[];
        setFriendTrades(mapped);
      }
      
      console.log("Friends.tsx: Setting communities...");
      if (theirCommunities) {
        const myCommIds = new Set(myComms?.map(c => c.community_id) || []);
        const formattedComms = theirCommunities
          .filter((c: any) => c.communities) // Ignore if joined community is hidden/null
          .map((c: any) => {
            const commData = Array.isArray(c.communities) ? c.communities[0] : c.communities;
            return {
              ...commData,
              isMutual: myCommIds.has(c.community_id)
            };
          });
        setFriendCommunities(formattedComms);
      } else {
        setFriendCommunities([]);
      }

      console.log("Friends.tsx: Fetching friendships (if not private)...");
      if (!settings?.friends_private || friends.some(f => f.id === friend.id)) {
        const { data: theirFriendships } = await supabase
          .from('friendships')
          .select('*')
          .eq('status', 'accepted')
          .or(`user_id.eq.${friend.id},friend_id.eq.${friend.id}`);
          
        if (theirFriendships) {
          const userIds = new Set<string>();
          theirFriendships.forEach(f => {
            if (f.user_id !== friend.id) userIds.add(f.user_id);
            if (f.friend_id !== friend.id) userIds.add(f.friend_id);
          });
          
          if (userIds.size > 0) {
            const { data: friendsSettings } = await supabase
              .from('user_settings')
              .select('user_id, username, avatar_url')
              .in('user_id', Array.from(userIds));
              
            const followingIds = new Set(theirFriendships.filter(f => f.user_id === friend.id).map(f => f.friend_id));
            const followerIds = new Set(theirFriendships.filter(f => f.friend_id === friend.id).map(f => f.user_id));
            const myFriendIds = new Set(friends.map(f => f.id));
              
            const mappedFriends = Array.from(userIds).map(fid => {
              const fset = friendsSettings?.find(s => s.user_id === fid);
              return { 
                 id: fid, 
                 username: fset?.username || 'Unknown', 
                 avatar_url: fset?.avatar_url,
                 isMutual: myFriendIds.has(fid)
              };
            });
            setFriendsOfFriend(mappedFriends);

            setSelectedFriend(prev => prev ? { 
              ...prev, 
              followersCount: followerIds.size, 
              followingCount: followingIds.size,
              likesCount: 0 
            } : null);
          } else {
            setFriendsOfFriend([]);
            setSelectedFriend(prev => prev ? { ...prev, followersCount: 0, followingCount: 0, likesCount: 0 } : null);
          }
        } else {
          setFriendsOfFriend([]);
          setSelectedFriend(prev => prev ? { ...prev, followersCount: 0, followingCount: 0, likesCount: 0 } : null);
        }
      } else {
        setFriendsOfFriend([]);
        setSelectedFriend(prev => prev ? { ...prev, followersCount: 0, followingCount: 0, likesCount: 0 } : null);
      }

      console.log("Friends.tsx: All fetched successfully. Setting activeView='friend'");
      setActiveView('friend');
    } catch (err) {
      console.error("Friends.tsx: error in viewFriend", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate friend stats
  const friendStats = useMemo(() => {
    if (!friendTrades.length) return null;
    
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    
    const monthTrades = friendTrades.filter(t => t.soldTimestamp >= startOfMonth && t.soldTimestamp <= endOfMonth);
    const netPnl = monthTrades.reduce((sum, t) => sum + t.pnl, 0);
    
    const wins = friendTrades.filter(t => t.pnl > 0);
    const losses = friendTrades.filter(t => t.pnl < 0);
    const breakevens = friendTrades.filter(t => t.pnl === 0);
    
    const winRate = friendTrades.length ? (wins.length / friendTrades.length) * 100 : 0;
    
    const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
    const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss;
    
    const avgWin = wins.length ? grossProfit / wins.length : 0;
    const avgLoss = losses.length ? grossLoss / losses.length : 0;
    
    // Best/Worst Day
    const dailyPnl: Record<string, number> = {};
    friendTrades.forEach(t => {
      const d = new Date(t.soldTimestamp).toLocaleDateString();
      dailyPnl[d] = (dailyPnl[d] || 0) + t.pnl;
    });
    
    let bestDay = { date: '-', pnl: 0 };
    let worstDay = { date: '-', pnl: 0 };
    
    Object.entries(dailyPnl).forEach(([date, pnl]) => {
      if (pnl > bestDay.pnl) bestDay = { date, pnl };
      if (pnl < worstDay.pnl) worstDay = { date, pnl };
    });

    // Calendar logic
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
    
    const calendarDays = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dayStart = new Date(now.getFullYear(), now.getMonth(), day).getTime();
      const dayEnd = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59, 999).getTime();
      
      const dayTrades = monthTrades.filter(t => t.soldTimestamp >= dayStart && t.soldTimestamp <= dayEnd);
      const dayPnl = dayTrades.reduce((sum, t) => sum + t.pnl, 0);
      
      return { day, pnl: dayPnl, trades: dayTrades };
    });

    const maxAbsPnl = Math.max(...calendarDays.map(d => Math.abs(d.pnl)), 1);

    return {
      netPnl,
      winRate,
      breakevens: breakevens.length,
      profitFactor,
      avgWin,
      avgLoss,
      bestDay,
      worstDay,
      calendarDays,
      firstDay,
      maxAbsPnl
    };
  }, [friendTrades]);

  const renderLeaderboard = (isBubble = false) => {
    const displayBoard = leaderboard.slice(0, leaderboardLimit);
    
    return (
      <div className={`rounded-3xl border p-6 backdrop-blur-2xl ${isBubble ? 'absolute bottom-8 right-8 w-80 shadow-2xl z-50' : ''}`} style={panelStyle}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Monthly P&L Leaderboard
          </h2>
        </div>
        
        <div className="space-y-3">
          {displayBoard.map((entry, idx) => (
            <div 
              key={entry.id} 
              onClick={() => viewFriend({ id: entry.id, username: entry.name, avatar_url: entry.avatar_url })}
              className="flex items-center justify-between p-3 rounded-2xl border cursor-pointer hover:bg-white/5 transition-all duration-300 hover:scale-[1.02]" 
              style={softPanelStyle}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`flex shrink-0 h-8 w-8 items-center justify-center rounded-full font-bold ${idx === 0 ? 'bg-amber-500/20 text-amber-400' : idx === 1 ? 'bg-slate-300/20 text-slate-300' : idx === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-white/50'}`}>
                  {idx + 1}
                </div>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex shrink-0 h-8 w-8 items-center justify-center rounded-full bg-white/10 font-bold text-white uppercase">
                    {entry.name[0]}
                  </div>
                )}
                <span className="font-medium text-white truncate min-w-0" title={entry.name}>
                  {entry.name.length > 16 ? entry.name.slice(0, 16) + "..." : entry.name}
                </span>
              </div>
              <span className={`font-bold shrink-0 ml-2 ${entry.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatSignedCurrency(entry.pnl)}
              </span>
            </div>
          ))}
          {leaderboard.length === 0 && <div className="text-slate-400 text-sm text-center py-4">No data for this month.</div>}
        </div>
        
        {leaderboard.length > 5 && (
          <div className="mt-4 flex justify-center">
            <select 
              value={leaderboardLimit} 
              onChange={(e) => setLeaderboardLimit(Number(e.target.value))}
              className="bg-transparent text-sm text-slate-400 outline-none hover:text-white transition-colors cursor-pointer"
            >
              <option value={5}>Top 5</option>
              <option value={10}>Top 10</option>
              <option value={20}>Top 20</option>
              <option value={999}>All</option>
            </select>
          </div>
        )}
      </div>
    );
  };

  const renderModals = () => (
    <>
      {/* Friends Modals */}
      {selectedFriendDay && friendStats && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: hexToRgba(panelTint, 0.75) }}
          onClick={() => setSelectedFriendDay(null)}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl border p-6 backdrop-blur-2xl modal-pop"
            style={panelStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">Day {selectedFriendDay} Trades</h3>
              </div>
              <button onClick={() => setSelectedFriendDay(null)} className="rounded-2xl p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-4 max-h-[58vh] space-y-3 overflow-y-auto custom-scrollbar pr-1">
              {friendTrades.filter(t => new Date(t.soldTimestamp).getDate() === selectedFriendDay).map((trade) => {
                return (
                  <button
                    key={trade.id}
                    onClick={() => setSelectedFriendTrade(trade)}
                    className="w-full rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
                    style={softPanelStyle}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{trade.symbol || "UNKNOWN"}</span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-100">{(trade.direction || "").toUpperCase()}</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">Exit {new Date(trade.soldTimestamp).toLocaleString()} • Qty {trade.qty}</div>
                        {trade.images && trade.images.length > 0 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                            {trade.images.map((img, i) => (
                              <div 
                                key={i} 
                                className="relative h-16 w-24 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 cursor-pointer transition-transform hover:scale-110"
                                onClick={(e) => { e.stopPropagation(); setZoomedImage(img); }}
                              >
                                <img src={img} alt="Trade screenshot" className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${trade.pnl > 0 ? "text-emerald-400" : trade.pnl < 0 ? "text-rose-400" : "text-slate-400"}`}>{formatSignedCurrency(trade.pnl)}</div>
                        <div className="mt-1 text-xs text-slate-400">View details</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {friendTrades.filter(t => new Date(t.soldTimestamp).getDate() === selectedFriendDay).length === 0 && (
                 <div className="text-center py-8 text-slate-400">No trades on this day.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedFriendTrade && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-md"
          style={{ background: hexToRgba(panelTint, 0.75) }}
          onClick={() => setSelectedFriendTrade(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar rounded-3xl border p-6 backdrop-blur-2xl modal-pop"
            style={panelStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedFriendTrade.symbol} Trade Details</h3>
                <p className="mt-1 text-sm text-slate-400">ID: {selectedFriendTrade.buyFillId}</p>
              </div>
              <button onClick={() => setSelectedFriendTrade(null)} className="rounded-2xl p-2 text-slate-400 hover:bg-white/10 hover:text-white">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border p-4 grid grid-cols-2 gap-4" style={softPanelStyle}>
                 <div>
                    <div className="text-sm text-slate-400">Start Price</div>
                    <div className="font-semibold text-white">${selectedFriendTrade.direction === "short" ? selectedFriendTrade.sellPrice : selectedFriendTrade.buyPrice}</div>
                 </div>
                 <div>
                    <div className="text-sm text-slate-400">End Price</div>
                    <div className="font-semibold text-white">${selectedFriendTrade.direction === "short" ? selectedFriendTrade.buyPrice : selectedFriendTrade.sellPrice}</div>
                 </div>
                 <div>
                    <div className="text-sm text-slate-400">Quantity</div>
                    <div className="font-semibold text-white">{selectedFriendTrade.qty}</div>
                 </div>
                 <div>
                    <div className="text-sm text-slate-400">P&L</div>
                    <div className={`font-semibold ${selectedFriendTrade.pnl > 0 ? "text-emerald-400" : selectedFriendTrade.pnl < 0 ? "text-rose-400" : "text-amber-400"}`}>{formatSignedCurrency(selectedFriendTrade.pnl)}</div>
                 </div>
                 {selectedFriendTrade.maxPointsProfit !== undefined && (
                   <div>
                      <div className="text-sm text-slate-400">Max Points Profit</div>
                      <div className="font-semibold text-white">{selectedFriendTrade.maxPointsProfit}</div>
                   </div>
                 )}
                 {selectedFriendTrade.commission !== undefined && (
                   <div>
                      <div className="text-sm text-slate-400">Commission</div>
                      <div className="font-semibold text-white">${selectedFriendTrade.commission}</div>
                   </div>
                 )}
              </div>

              {(selectedFriendTrade.confluence?.length > 0 || selectedFriendTrade.mistake?.length > 0 || selectedFriendTrade.session?.length > 0 || selectedFriendTrade.entry?.length > 0) && (
                <div className="rounded-2xl border p-4 space-y-4" style={softPanelStyle}>
                  {selectedFriendTrade.session && selectedFriendTrade.session.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-slate-400 mb-2">Session</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedFriendTrade.session.map(tag => (
                          <div key={tag} className="rounded-lg px-2 py-1 text-xs font-semibold bg-white/10 text-white border border-white/5">{tag}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedFriendTrade.confluence && selectedFriendTrade.confluence.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-slate-400 mb-2">Confluence</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedFriendTrade.confluence.map(tag => (
                          <div key={tag} className="rounded-lg px-2 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/10">{tag}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedFriendTrade.mistake && selectedFriendTrade.mistake.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-slate-400 mb-2">Mistakes</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedFriendTrade.mistake.map(tag => (
                          <div key={tag} className="rounded-lg px-2 py-1 text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/10">{tag}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedFriendTrade.entry && selectedFriendTrade.entry.length > 0 && (
                    <div>
                      <div className="text-sm font-semibold text-slate-400 mb-2">Entries</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedFriendTrade.entry.map(tag => (
                          <div key={tag} className="rounded-lg px-2 py-1 text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/10">{tag}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {selectedFriendTrade.notes && (
                <div className="rounded-2xl border p-4" style={softPanelStyle}>
                  <div className="text-sm font-semibold text-slate-400 mb-2">Notes</div>
                  <p className="text-sm text-white whitespace-pre-wrap">{selectedFriendTrade.notes}</p>
                </div>
              )}
              {selectedFriendTrade.images && selectedFriendTrade.images.length > 0 && (
                <div className="rounded-2xl border p-4 space-y-3" style={softPanelStyle}>
                  <div className="font-semibold text-white">Screenshots</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {selectedFriendTrade.images.map((img, idx) => (
                       <div 
                         key={idx} 
                         className="relative h-24 rounded-lg overflow-hidden border border-white/10 cursor-pointer"
                         onClick={() => setZoomedImage(img)}
                       >
                         <img src={img} alt="Screenshot" className="w-full h-full object-cover transition-transform hover:scale-110" />
                       </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {zoomedImage && (
        <div
          className="fixed inset-0 z-[100] flex flex-col p-4 md:p-8 backdrop-blur-xl"
          style={{ background: hexToRgba(panelTint, 0.95) }}
          onClick={() => setZoomedImage(null)}
        >
          <div className="flex justify-end p-4 shrink-0">
            <button className="rounded-2xl p-3 bg-white/10 hover:bg-white/20 transition-colors text-white backy" onClick={() => setZoomedImage(null)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 w-full min-h-0 flex items-center justify-center p-2" onClick={(e) => setZoomedImage(null)}>
            <img src={zoomedImage} alt="Zoomed view" className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl modal-pop" onClick={e => e.stopPropagation()} />
          </div>
        </div>
      )}
      {/* Selected Day Modal */}
      {selectedDayKey && selectedDayTrades && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
          onClick={() => setSelectedDayKey(null)}
        >
          <div
            className="modal-pop w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border p-6 backdrop-blur-2xl"
            style={panelStyle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedDayTrades.title}</h3>
              </div>
              <button onClick={() => setSelectedDayKey(null)} className="rounded-full text-slate-400 hover:bg-white/10 hover:text-white p-1">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-3 shrink-0 text-sm text-slate-400">Click any trade below to view details.</div>
            <div className="mt-4 space-y-3 p-2 -mx-2 flex-1 overflow-y-auto custom-scrollbar">
              {selectedDayTrades.trades.map((trade: any) => {
                if (!trade) return null;
                const status = getTradeStatus(trade.pnl || 0, -50, 50);
                const tone = status === "WIN" ? { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" } : status === "LOSS" ? { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400" } : { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400" };
                
                return (
                  <button
                    key={trade.id}
                    onClick={() => {
                      setSelectedFriendTrade(trade);
                      setSelectedDayKey(null);
                    }}
                    className="w-full rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01]"
                    style={softPanelStyle}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${tone.bg} ${tone.border} ${tone.text}`}>
                          {status === "WIN" ? <TrendingUp className="h-5 w-5" /> : status === "LOSS" ? <TrendingDown className="h-5 w-5" /> : <div className="h-2 w-4 rounded-full bg-current" />}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            {trade.symbol}
                            <span className="rounded-md border border-white/10 bg-white/5 xl:px-1.5 xl:py-0.5 px-1 py-0.5 text-[8px] sm:text-[10px] uppercase tracking-wider text-slate-300">
                              {(trade.direction || "").toUpperCase()}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                            <span>{new Date(trade.soldTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span>•</span>
                            <span>{trade.qty} Qty</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-semibold ${tone.text}`}>{formatSignedCurrency(trade.pnl || 0)}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
              {selectedDayTrades.trades.length === 0 && (
                <div className="text-center py-8 text-slate-500">No trades recorded on this day.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (isLoading && viewUserId) {
    if (isModal) {
      return (
        <div className="fixed inset-0 z-[1000] p-4 flex items-center justify-center backdrop-blur-md bg-black/40 mt-[env(safe-area-inset-top)] sm:mt-16">
          <div className="flex items-center justify-center py-32">
             <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center py-32 w-full">
         <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
      </div>
    );
  }

  if ((activeView === 'friend' || activeView === 'friend-journal') && selectedFriend) {
    const friendContent = (
      <div className="space-y-6 relative min-h-[80vh]">
        {!isModal && (
          <button 
            onClick={() => {
              setActiveView('list');
              if (onThemeChange) onThemeChange(null);
              if (setViewUserId) setViewUserId(null);
            }}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Friends
          </button>
        )}
        
        <div className={`flex items-center gap-4 mb-6 relative w-full ${isModal ? 'pr-12 block' : ''}`}>
          <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-white uppercase overflow-hidden shrink-0 mt-2 sm:mt-0">
            {typeof selectedFriend?.avatar_url === 'string' && selectedFriend.avatar_url.trim() !== '' ? <img src={selectedFriend.avatar_url} alt="" className="w-full h-full object-cover" /> : selectedFriend?.username?.[0] || '?'}
          </div>
          <div className="flex-1 min-w-0 pr-2 mt-2 sm:mt-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate">{selectedFriend.username || selectedFriend.full_name}</h1>
            <p className="text-slate-400 text-sm">Viewing friend's {activeView === 'friend-journal' ? 'journal' : 'profile'}</p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0 mt-2 sm:mt-0">
            {activeView === 'friend' && !isModal && (
              <button
                onClick={() => setActiveView('friend-journal')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                style={accentButtonStyle}
              >
                <BookOpen className="h-4 w-4" /> View Journal
              </button>
            )}
            {activeView === 'friend-journal' && !isModal && (
              <button
                onClick={() => setActiveView('friend')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                style={{ ...accentButtonStyle, background: hexToRgba(accentColor, 0.4) }}
              >
                <ArrowLeft className="h-4 w-4" /> Back to Profile
              </button>
            )}
            {selectedFriend.id !== user?.id && !friends.some(f => f.id === selectedFriend.id) && !requests.some(r => r.id === selectedFriend.id) && (
              <div className="bg-black/20 p-2 rounded-xl border border-white/5 backdrop-blur-xl flex flex-col items-end gap-2">
                <button
                  onClick={() => sendQuickFriendRequest(selectedFriend.id)}
                  className="relative inline-flex items-center justify-center font-semibold text-sm text-white rounded-xl shadow-lg transition-all border border-white/10 hover:border-white/20 px-3 sm:px-4 py-2 overflow-hidden w-[100px] sm:w-[120px]"
                  style={accentButtonStyle}
                >
                  <div className={`transition-transform duration-300 whitespace-nowrap ${friendAnimState ? '-translate-y-10' : 'translate-y-0'}`}>Follow</div>
                  <div className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${friendAnimState ? 'translate-y-0' : 'translate-y-10'}`}>
                    <Check className="h-4 w-4" />
                  </div>
                </button>
              </div>
            )}
            
            {selectedFriend.id !== user?.id && friends.some(f => f.id === selectedFriend.id && f.iFollowThem) && (
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => setFriendToRemove(selectedFriend)}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-semibold text-rose-400 bg-rose-500/10 rounded-xl transition-all border border-rose-500/20 hover:bg-rose-500/20 hover:scale-105 active:scale-95 whitespace-nowrap"
                >
                  <UserMinus className="h-4 w-4" /> <span className="hidden sm:inline">Unfollow</span><span className="sm:hidden">Unfollow</span>
                </button>
              </div>
            )}
            {activeView === 'friend' && !isModal && (
              <button
                onClick={() => setActiveView('friend-journal')}
                className="sm:hidden inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                style={accentButtonStyle}
              >
                <BookOpen className="h-4 w-4" />
              </button>
            )}
            {activeView === 'friend-journal' && !isModal && (
              <button
                onClick={() => setActiveView('friend')}
                className="sm:hidden inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white rounded-xl shadow-lg transition-transform hover:-translate-y-0.5"
                style={{ ...accentButtonStyle, background: hexToRgba(accentColor, 0.4) }}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {activeView === 'friend' && (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-3xl border p-6 text-center backdrop-blur-2xl" style={panelStyle}>
                <div className="text-3xl font-bold text-white">{selectedFriend.settings?.hidden_connections ? '-' : (selectedFriend.followersCount || 0)}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">Followers</div>
              </div>
              <div className="rounded-3xl border p-6 text-center backdrop-blur-2xl" style={panelStyle}>
                <div className="text-3xl font-bold text-white">{selectedFriend.settings?.hidden_connections ? '-' : (selectedFriend.followingCount || 0)}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">Following</div>
              </div>
              <div className="rounded-3xl border p-6 text-center backdrop-blur-2xl" style={panelStyle}>
                <div className="text-3xl font-bold text-emerald-400">{selectedFriend.likesCount || 0}</div>
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-1">Likes</div>
              </div>
            </div>
            
            {friendsOfFriend && friendsOfFriend.length > 0 && !selectedFriend.settings?.hidden_connections && (
              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <h2 className="text-xl font-semibold text-white mb-4">Mutual Friends</h2>
                <div className="flex flex-wrap gap-4">
                  {friendsOfFriend.map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border cursor-pointer hover:bg-white/5 transition-colors relative"
                      style={{ ...softPanelStyle, ...(f.isMutual ? { borderColor: hexToRgba('#10b981', 0.4) } : {}) }}
                      onClick={() => viewFriend(f)}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden">
                        {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : f.username?.[0] || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{f.username}</div>
                        {f.isMutual && <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Mutual</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {friendCommunities && friendCommunities.length > 0 && (
              <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
                <h2 className="text-xl font-semibold text-white mb-4">Communities</h2>
                <div className="flex flex-wrap gap-4">
                  {friendCommunities.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 rounded-2xl border text-left relative"
                      style={{ ...softPanelStyle, ...(c.isMutual ? { borderColor: hexToRgba('#10b981', 0.4) } : {}) }}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden">
                        {c.avatar_url ? <img src={c.avatar_url} alt="" className="w-full h-full object-cover" /> : c.name?.[0] || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{c.name}</div>
                        {c.isMutual && <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1"><Check className="h-3 w-3" /> Mutual</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeView === 'friend-journal' && friendStats && (
          <div className="space-y-6">
            <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Calendar P&L</h2>
                  <div className={`mt-1 text-xl font-semibold ${friendStats.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>Current Month Total: {formatSignedCurrency(friendStats.netPnl)}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
              <div className="rounded-3xl border p-2 sm:p-3 backdrop-blur-2xl" style={panelStyle}>
                <div className="grid grid-cols-7 gap-1 sm:gap-2.5">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
                    <div key={label} className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      <span className="hidden sm:inline">{label}</span>
                      <span className="sm:hidden">{label.slice(0, 1)}</span>
                    </div>
                  ))}

                  {Array.from({ length: friendStats.firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="rounded-2xl bg-transparent aspect-square h-auto w-full" />
                  ))}
                  {friendStats.calendarDays.map((day: any) => {
                    const intensity = Math.min(Math.abs(day.pnl) / friendStats.maxAbsPnl, 1);
                    const dayBackground =
                        day.pnl > 0
                          ? hexToRgba("#10b981", 0.12 + intensity * 0.24)
                          : day.pnl < 0
                          ? hexToRgba("#f43f5e", 0.12 + intensity * 0.24)
                          : hexToRgba(panelTint, 0.26);
                    return (
                      <button
                        key={day.day}
                        onClick={() => setSelectedFriendDay(day.day)}
                        className={`group relative flex flex-col justify-between rounded-xl sm:rounded-2xl border p-1.5 sm:p-2 text-left transition duration-200 aspect-square overflow-hidden hover:-translate-y-0.5`}
                        style={{
                          height: `auto`,
                          width: `100%`,
                          background: dayBackground,
                          borderColor: day.trades.length ? hexToRgba(accentColor, 0.18) : hexToRgba("#ffffff", 0.08),
                        }}
                      >
                        <div className="w-full flex justify-between items-start">
                          <div className="text-[10px] sm:text-xs md:text-sm font-semibold text-white leading-none">{day.day}</div>
                        </div>
                        <div className="w-full flex flex-col mt-auto justify-end pt-1">
                          {day.trades.length > 0 ? (
                            <>
                              <div className={`text-[10px] min-[380px]:text-xs sm:text-base md:text-lg font-bold tracking-tight truncate w-full text-left ${day.pnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                                <span className="sm:hidden">{Math.abs(Math.round(day.pnl))}</span>
                                <span className="hidden sm:inline">{day.pnl > 0 ? `+` : ''}{formatSignedCurrency(day.pnl)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[8px] sm:text-[10px] md:text-xs text-slate-300 truncate w-full mt-0.5">
                                <span>{day.trades.length} <span className="hidden sm:inline">{day.trades.length === 1 ? 'trade' : 'trades'}</span></span>
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px] min-[380px]:text-xs sm:text-base md:text-lg font-bold text-slate-500">-</div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-1 sm:space-y-2.5 flex flex-col xl:justify-center">
                  <div className="rounded-xl sm:rounded-2xl border p-2 sm:p-3 flex items-center justify-between sm:block" style={{ ...panelStyle, height: `auto`, minHeight: 'unset' }}>
                    <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Total Profit</div>
                    <div className={`sm:mt-2 text-xs sm:text-base font-semibold ${friendStats.netPnl >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{formatSignedCurrency(friendStats.netPnl)}</div>
                  </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mt-4 sm:mt-6">
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1" style={panelStyle}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Month Best Day</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-emerald-300">{formatSignedCurrency(friendStats.bestDay.pnl)}</div>
                <div className="text-xs text-slate-500 mt-1">{friendStats.bestDay.date || '-'}</div>
              </div>
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1" style={panelStyle}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Month Worst Day</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-rose-300">{formatSignedCurrency(friendStats.worstDay.pnl)}</div>
                <div className="text-xs text-slate-500 mt-1">{friendStats.worstDay.date || '-'}</div>
              </div>
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1 cursor-pointer" style={panelStyle}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Win Rate</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-emerald-300">{friendStats.winRate.toFixed(1)}%</div>
              </div>
              <div 
                className="rounded-2xl border p-3 sm:p-4 transition-transform hover:-translate-y-1 cursor-pointer" style={panelStyle}
              >
                <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Profit Factor</div>
                <div className="mt-1 sm:mt-2 text-sm sm:text-lg font-semibold text-violet-400">{friendStats.profitFactor === 999 ? '∞' : friendStats.profitFactor.toFixed(2)}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 mt-2 sm:mt-4">
                <div className="rounded-2xl border p-3 sm:p-4" style={panelStyle}>
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Average Win</div>
                  <div className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-emerald-300">{formatSignedCurrency(friendStats.avgWin)}</div>
                </div>
                <div className="rounded-2xl border p-3 sm:p-4" style={panelStyle}>
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">Average Loss</div>
                  <div className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-rose-300">{formatSignedCurrency(friendStats.avgLoss)}</div>
                </div>
                <div className="rounded-2xl border p-3 sm:p-4 col-span-2 lg:col-span-1" style={panelStyle}>
                  <div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-slate-400">BE Trades</div>
                  <div className="mt-1 sm:mt-2 text-sm sm:text-base font-semibold text-amber-400">
                    {friendStats.breakevens}
                  </div>
                </div>
             </div>
          </div>
        )}

        {activeView === 'friend' && (
          <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
            <h2 className="text-xl font-semibold text-white mb-4">5 Recent Trades</h2>
            <div className="space-y-4">
              {friendTrades.slice(0, 5).map(trade => (
                <div 
                  key={trade.id} 
                  className="group relative rounded-2xl border p-4 transition-all duration-300 hover:scale-[1.01] cursor-pointer" 
                  style={softPanelStyle}
                  onClick={() => setSelectedFriendTrade(trade)}
                >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl font-bold ${trade.pnl > 0 ? 'bg-emerald-500/20 text-emerald-400' : trade.pnl < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                      {trade.symbol}
                    </div>
                    <div>
                      <div className="font-semibold text-white">{new Date(trade.soldTimestamp).toLocaleString()}</div>
                      <div className="text-sm text-slate-400">{(trade.direction || "").toUpperCase()} • {trade.qty} qty</div>
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${trade.pnl > 0 ? 'text-emerald-400' : trade.pnl < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                    {formatSignedCurrency(trade.pnl)}
                  </div>
                </div>
                
                {trade.images && trade.images.length > 0 && (
                  <div className="grid transition-all duration-300 grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 mt-0 group-hover:mt-4">
                    <div className="overflow-hidden">
                      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2">
                        {trade.images.map((img, i) => (
                          <div 
                            key={i} 
                            className="relative h-24 w-36 flex-shrink-0 rounded-xl overflow-hidden border border-white/10 cursor-pointer transition-transform hover:scale-105"
                            onClick={(e) => { e.stopPropagation(); setZoomedImage(img); }}
                          >
                            <img src={img} alt="Trade screenshot" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {friendTrades.length === 0 && <div className="text-slate-400 text-center py-8">No recent trades found.</div>}
          </div>
        </div>
        )}

        {renderModals()}
        
        <ConfirmModal
          isOpen={!!friendToRemove}
          onClose={() => setFriendToRemove(null)}
          onConfirm={() => {
            if (friendToRemove) removeFriend(friendToRemove.id);
            setFriendToRemove(null);
          }}
          title="Unfollow"
          message={`Are you sure you want to unfollow ${friendToRemove?.username}?`}
          confirmText="Unfollow"
          cancelText="Cancel"
          panelTint={panelTint}
        />
      </div>
    );

    if (isModal) {
      return (
        <div className="fixed inset-0 z-[1000] p-4 flex items-center justify-center backdrop-blur-md bg-black/40 mt-[env(safe-area-inset-top)] sm:mt-16">
          <div className="absolute inset-0" onClick={() => {
            setActiveView('list');
            if (onThemeChange) onThemeChange(null);
            if (setViewUserId) setViewUserId(null);
          }} />
          <div className="w-full max-w-5xl max-h-[calc(100vh-2rem-4rem)] overflow-y-auto custom-scrollbar relative z-10 p-6 rounded-3xl border shadow-2xl modal-pop" style={panelStyle}>
            <button onClick={() => {
              setActiveView('list');
              if (onThemeChange) onThemeChange(null);
              if (setViewUserId) setViewUserId(null);
            }} className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 z-50 bg-black/20 backdrop-blur-md border border-white/10">
              <X className="h-5 w-5" />
            </button>
            {friendContent}
          </div>
          {renderModals()}
        </div>
      );
    }

    return (
      <>
        {friendContent}
      </>
    );
  }

  if (isModal) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
            <h2 className="text-xl font-semibold text-white mb-4">Follow User</h2>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  placeholder="Enter username to follow..."
                  className="w-full rounded-2xl border pl-12 pr-4 py-3 outline-none text-white"
                  style={{ background: hexToRgba(panelTint, 0.35), borderColor: hexToRgba(accentColor, 0.16) }}
                />
              </div>
              <button 
                onClick={handleAddFriend}
                disabled={isLoading || !searchUsername.trim()}
                className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 font-semibold text-white disabled:opacity-50"
                style={accentButtonStyle}
              >
                <UserPlus className="h-5 w-5" /> Follow
              </button>
            </div>
            {searchMessage && <div className="mt-3 text-sm text-slate-300">{searchMessage}</div>}
          </div>

          <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
            <h2 className="text-xl font-semibold text-white mb-4">Follow Requests</h2>
            {requests.length > 0 ? (
              <div className="space-y-3">
                {requests.map(req => (
                  <div key={req.request_id} className="flex items-center justify-between p-4 rounded-2xl border" style={softPanelStyle}>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden">
                        {req.avatar_url ? <img src={req.avatar_url} alt="" className="w-full h-full object-cover" /> : req.username?.[0] || '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{req.username}</div>
                        <div className="text-xs text-slate-400">Wants to follow you</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAcceptRequest(req.request_id)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                        Approve
                      </button>
                      <button onClick={() => handleRejectRequest(req.request_id)} title="Deny" className="p-2 rounded-xl bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 transition-colors">
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-4">
                No pending requests.
              </div>
            )}
            
            {friends.filter(f => f.theyFollowMe && !f.isMutual).length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold text-white mb-4">Followers (Not Mutual)</h3>
                <div className="space-y-3">
                  {friends.filter(f => f.theyFollowMe && !f.isMutual).map(f => (
                    <div key={f.id} className="flex items-center justify-between p-4 rounded-2xl border" style={softPanelStyle}>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden">
                          {f.avatar_url ? <img src={f.avatar_url} alt="" className="w-full h-full object-cover" /> : f.username?.[0] || '?'}
                        </div>
                        <div>
                          <div className="font-semibold text-white">{f.username}</div>
                          <div className="text-xs text-slate-400">Follows you</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleFollowBack(f.id)} className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors">
                          Follow Back
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
            <h2 className="text-xl font-semibold text-white mb-4">Recent Trades from Friends</h2>
            {recentFriendTrades.length > 0 ? (
              <div className="space-y-3">
                {recentFriendTrades.map((t) => {
                  const status = t.pnl > 0 ? "WIN" : t.pnl < 0 ? "LOSS" : "BE";
                  const toneColor = t.pnl > 0 ? "text-emerald-400" : t.pnl < 0 ? "text-rose-400" : "text-amber-400";
                  const borderTone = t.pnl > 0 ? "border-emerald-500/30" : t.pnl < 0 ? "border-rose-500/30" : "border-amber-500/30";
                  return (
                    <div key={t.id} className="group relative flex items-center justify-between p-4 rounded-2xl border transition-all" style={softPanelStyle}>
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden">
                          {t.friendAvatar ? <img src={t.friendAvatar} alt="" className="w-full h-full object-cover" /> : t.friendName?.[0] || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white">{t.friendName}</span>
                            <span className="text-xs text-slate-400">traded</span>
                            <span className="font-semibold text-white uppercase">{t.symbol}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider ${borderTone} ${toneColor}`}>
                              {status}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {new Date(t.sold_timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {t.images && t.images.length > 0 && (
                          <div className="relative group/img cursor-pointer" onClick={() => setZoomedImage(t.images[0])}>
                            <img src={t.images[0]} alt="Trade screenshot" className="w-10 h-10 rounded-lg object-cover opacity-60 group-hover/img:opacity-100 transition-opacity border border-white/10" />
                            {/* Hover tooltip */}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible transition-all duration-300 z-50 pointer-events-none shadow-2xl">
                              <img src={t.images[0]} alt="Hover preview" className="w-48 h-auto max-h-48 rounded-xl object-contain border border-white/10 bg-black/80 backdrop-blur-xl" />
                            </div>
                          </div>
                        )}
                        <div className={`font-semibold shrink-0 ${toneColor}`}>
                          {t.pnl > 0 ? '+' : ''}${Math.abs(t.pnl).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center py-6">No recent trades found.</div>
            )}
          </div>

          <div className="rounded-3xl border p-6 backdrop-blur-2xl" style={panelStyle}>
            <h2 className="text-xl font-semibold text-white mb-4">My Friends</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {friends.map(friend => (
                <div
                  key={friend.id} 
                  className="flex items-center justify-between gap-4 p-4 rounded-2xl border text-left transition-all hover:-translate-y-1 hover:shadow-xl cursor-pointer group" 
                  style={softPanelStyle}
                  onClick={() => viewFriend(friend)}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-white uppercase overflow-hidden shrink-0">
                      {friend.avatar_url ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover" /> : friend.username?.[0] || '?'}
                    </div>
                    <div>
                      <div className="font-semibold text-white group-hover:text-amber-300 transition-colors">{friend.username || friend.full_name}</div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <Eye className="h-3 w-3" /> View Journal
                      </div>
                    </div>
                  </div>
                  
                  <div className="shrink-0 flex items-center justify-center">
                    <DoubleClickRemoveFriend friend={friend} onRemove={(id) => removeFriend(id)} />
                  </div>
                </div>
              ))}
              {friends.length === 0 && (
                <div className="col-span-full text-center py-8 text-slate-400">
                  You haven't added any friends yet.
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          {renderLeaderboard(false)}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!friendToRemove}
        onClose={() => setFriendToRemove(null)}
        onConfirm={() => friendToRemove && removeFriend(friendToRemove.id)}
        title="Remove Friend"
        message={`Are you sure you want to remove ${friendToRemove?.username} from your friends list?`}
        confirmText="Remove"
        cancelText="Cancel"
        panelTint={panelTint}
      />

      {renderModals()}
    </div>
  );
}
