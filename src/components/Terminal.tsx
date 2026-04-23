import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { normalizeSymbol } from '../App';
import { TrendingUp, TrendingDown, Image as ImageIcon, Eye, Heart, MessageCircle, Bell, X, Send, Loader2 } from 'lucide-react';

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

export function Terminal({ 
  user,
  panelStyle,
  softPanelStyle,
  accentColor,
  accentButtonStyle,
  panelTint,
  openTradeViewer,
  onNavigate
}: any) {
  const [activeTab, setActiveTab] = useState<'feed' | 'trending'>('feed');
  const [showNotifications, setShowNotifications] = useState(false);
  const [feedTrades, setFeedTrades] = useState<any[]>([]);
  const [trendingTrades, setTrendingTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Interactions State
  const [likes, setLikes] = useState<Record<string, { count: number, likedByMe: boolean }>>({});
  const [comments, setComments] = useState<Record<string, any[]>>({});
  
  // Comments Modal State
  const [activeCommentTrade, setActiveCommentTrade] = useState<any | null>(null);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  
  // Image Hover / Zoom State
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const loadNotifications = async () => {
      try {
          const notifs = [];
          
          const { data: myTrades } = await supabase.from('trades_v2').select('id, symbol').eq('user_id', user.id).limit(100);
          const myTradeIds = myTrades?.map(t => t.id) || [];
          
          if (myTradeIds.length > 0) {
              const { data: likesOut } = await supabase.from('trade_likes').select('created_at, user_id, trade_id').in('trade_id', myTradeIds).neq('user_id', user.id).limit(20);
              if (likesOut) {
                  for (const l of likesOut) {
                      notifs.push({ id: `like-${l.trade_id}-${l.user_id}`, type: 'like', user_id: l.user_id, date: l.created_at, trade_id: l.trade_id, text: 'liked your trade' });
                  }
              }
              
              const { data: commsOut } = await supabase.from('trade_comments').select('*').in('trade_id', myTradeIds).neq('user_id', user.id).limit(20);
              if (commsOut) {
                  for (const c of commsOut) {
                      notifs.push({ id: `comm-${c.id}`, type: 'comment', user_id: c.user_id, date: c.created_at, trade_id: c.trade_id, text: `commented: "${c.text}"` });
                  }
              }
          }
          
          const { data: followsOut } = await supabase.from('friendships').select('*').eq('friend_id', user.id).limit(20);
          if (followsOut) {
              for (const f of followsOut) {
                  notifs.push({ id: `fol-${f.user_id}`, type: 'follow', user_id: f.user_id, date: f.created_at || new Date().toISOString(), text: f.status === 'pending' ? 'requested to follow you' : 'started following you' });
              }
          }
          
          const uids = Array.from(new Set(notifs.map(n => n.user_id)));
          const { data: userSettings } = await supabase.from('user_settings').select('user_id, username, avatar_url').in('user_id', uids);
          const uMap: any = {};
          if (userSettings) userSettings.forEach(u => uMap[u.user_id] = u);
          
          const finalNotifs = notifs.map(n => ({
              ...n,
              actorName: uMap[n.user_id]?.username || 'Someone',
              actorAvatar: uMap[n.user_id]?.avatar_url
          })).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20);
          
          setNotifications(finalNotifs);
      } catch (e) {
          console.error(e);
      }
  };

  useEffect(() => {
    if (showNotifications) loadNotifications();
  }, [showNotifications]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'feed') {
        const { data: friendships } = await supabase
          .from('friendships')
          .select('*')
          .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

        const followedIds = new Set<string>();
        if (friendships) {
          friendships.forEach(f => {
            if (f.user_id === user.id && (f.status === 'accepted' || f.status === 'pending')) followedIds.add(f.friend_id);
            if (f.friend_id === user.id && f.status === 'accepted') followedIds.add(f.user_id);
          });
        }
        
        const { data: myComms } = await supabase.from('community_members').select('community_id').eq('status', 'active').eq('user_id', user.id);
        if (myComms && myComms.length > 0) {
           const commIds = myComms.map(c => c.community_id);
           const { data: commMembers } = await supabase.from('community_members').select('user_id').in('community_id', commIds).eq('status', 'active');
           if (commMembers) {
              commMembers.forEach(m => followedIds.add(m.user_id));
           }
        }

        if (followedIds.size === 0) {
          setFeedTrades([]);
          setLoading(false);
          return;
        }

        const arrIds = Array.from(followedIds);
        const { data: recentTrades } = await supabase
          .from('trades_v2')
          .select('*')
          .in('user_id', arrIds)
          .not('images', 'is', null)
          .order('sold_timestamp', { ascending: false })
          .limit(30);

        if (recentTrades && recentTrades.length > 0) {
          const mapped = recentTrades.filter(t => t.images && t.images.length > 0)
          if (mapped.length > 0) {
            const userIds = Array.from(new Set(mapped.map(t => t.user_id)));
            const { data: settings } = await supabase.from('user_settings').select('user_id, username, avatar_url').in('user_id', userIds);
            const userMap: any = {};
            if (settings) settings.forEach(s => userMap[s.user_id] = { username: s.username, avatar_url: s.avatar_url });

            setFeedTrades(mapped.map(t => ({
              ...t,
              friendName: userMap[t.user_id]?.username || 'Unknown',
              friendAvatar: userMap[t.user_id]?.avatar_url
            })));
            initInteractions(mapped);
          } else {
             setFeedTrades([]);
          }
        } else {
          setFeedTrades([]);
        }

      } else {
        const { data: trending } = await supabase
          .from('trades_v2')
          .select('*')
          .not('images', 'is', null)
          .order('pnl', { ascending: false })
          .limit(100);

        if (trending && trending.length > 0) {
          const mapped = trending.filter(t => t.images && t.images.length > 0);
          if (mapped.length > 0) {
             const userIds = Array.from(new Set(mapped.map(t => t.user_id)));
             // ONLY load users who don't have private profiles
             const { data: settings } = await supabase.from('user_settings').select('user_id, username, avatar_url, profile_private').in('user_id', userIds).neq('profile_private', true);
             const userMap: any = {};
             if (settings) settings.forEach(s => userMap[s.user_id] = { username: s.username, avatar_url: s.avatar_url });
             
             // Filter out trades from users with private profiles or missing settings
             const filteredMapped = mapped.filter(t => userMap[t.user_id]);
             
             setTrendingTrades(filteredMapped.slice(0, 30).map(t => ({
               ...t,
               friendName: userMap[t.user_id]?.username || 'Unknown',
               friendAvatar: userMap[t.user_id]?.avatar_url
             })));
             initInteractions(filteredMapped.slice(0, 30));
          } else {
             setTrendingTrades([]);
          }
        } else {
          setTrendingTrades([]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const initInteractions = async (trades: any[]) => {
    if (!trades.length) return;
    const tradeIds = trades.map(t => t.id);
    
    try {
      const { data: likesData } = await supabase
        .from('trade_likes')
        .select('trade_id, user_id')
        .in('trade_id', tradeIds);
        
      const { data: commentsData } = await supabase
        .from('trade_comments')
        .select('*')
        .in('trade_id', tradeIds)
        .order('created_at', { ascending: true });

      const newLikes: Record<string, { count: number, likedByMe: boolean }> = { ...likes };
      const newComments: Record<string, any[]> = { ...comments };
      
      trades.forEach(t => {
         const tLikes = likesData?.filter(l => l.trade_id === t.id) || [];
         newLikes[t.id] = { 
           count: tLikes.length, 
           likedByMe: tLikes.some(l => l.user_id === user.id) 
         };
         
         const tComments = commentsData?.filter(c => c.trade_id === t.id) || [];
         newComments[t.id] = tComments.map(c => ({
            id: c.id,
            userId: c.user_id,
            username: c.username || 'Unknown',
            text: c.text,
            timestamp: c.created_at,
            replyTo: c.reply_to
         }));
      });
      
      setLikes(newLikes);
      setComments(newComments);
    } catch (err) {
      console.error("Error loading interactions:", err);
    }
  };

  const toggleLike = async (tradeId: string) => {
     const curr = likes[tradeId] || { count: 0, likedByMe: false };
     const isLiking = !curr.likedByMe;
     
     // Optimistic update
     setLikes(prev => ({
        ...prev,
        [tradeId]: {
           count: isLiking ? curr.count + 1 : curr.count - 1,
           likedByMe: isLiking
        }
     }));

     try {
       if (isLiking) {
         await supabase.from('trade_likes').insert({
           trade_id: tradeId,
           user_id: user.id
         });
       } else {
         await supabase.from('trade_likes').delete().match({
           trade_id: tradeId,
           user_id: user.id
         });
       }
     } catch (err) {
       console.error("Error toggling like:", err);
       // Revert on failure
       setLikes(prev => ({
          ...prev,
          [tradeId]: curr
       }));
     }
  };

  const submitComment = async () => {
     if (!newComment.trim() || !activeCommentTrade) return;
     
     const currentCommentStr = newComment;
     setNewComment(""); // Optimistic clear
     
     const username = user.user_metadata?.full_name || user.email?.split('@')[0] || "Me";
     
     // Optimistic UI update
     const optimisticCommentObj = {
        id: Math.random().toString(),
        userId: user.id,
        username,
        text: currentCommentStr,
        timestamp: new Date().toISOString(),
        replyTo: replyingTo ? replyingTo.username : null
     };

     setComments(prev => ({
        ...prev,
        [activeCommentTrade.id]: [...(prev[activeCommentTrade.id] || []), optimisticCommentObj]
     }));

     try {
       const { data, error } = await supabase.from('trade_comments').insert({
         trade_id: activeCommentTrade.id,
         user_id: user.id,
         username,
         text: currentCommentStr,
         reply_to: replyingTo ? replyingTo.username : null
       }).select().single();
       
       if (error) throw error;
       
       // Update with real ID and timestamp if needed, but we can also just wait for the next load.
     } catch (err) {
       console.error("Error submitting comment:", err);
       // Revert on error
       setComments(prev => {
         const tradeComms = prev[activeCommentTrade.id] || [];
         return {
           ...prev,
           [activeCommentTrade.id]: tradeComms.filter(c => c.id !== optimisticCommentObj.id)
         }
       });
       setNewComment(currentCommentStr);
     }
     
     setReplyingTo(null);
  };

  const renderTradeImages = (images: string[]) => {
    if (!images || images.length === 0) return null;
    
    if (images.length === 1) {
      return (
        <div 
           className="mt-4 rounded-2xl overflow-hidden border border-white/10 aspect-video cursor-pointer hover:opacity-90 transition-opacity"
           onClick={() => setZoomedImage(images[0])}
        >
          <img src={images[0]} alt="Trade" className="w-full h-full object-cover" />
        </div>
      );
    }

    if (images.length === 2) {
      return (
        <div className="mt-4 grid grid-cols-2 gap-2 h-64">
           <div 
             className="rounded-2xl overflow-hidden border border-white/10 relative cursor-pointer hover:opacity-90 transition-opacity"
             onClick={() => setZoomedImage(images[0])}
           >
             <img src={images[0]} alt="Trade" className="absolute inset-0 w-full h-full object-cover" />
           </div>
           <div 
             className="rounded-2xl overflow-hidden border border-white/10 relative cursor-pointer hover:opacity-90 transition-opacity"
             onClick={() => setZoomedImage(images[1])}
           >
             <img src={images[1]} alt="Trade" className="absolute inset-0 w-full h-full object-cover" />
           </div>
        </div>
      );
    }

    return (
      <div className="mt-4 grid grid-cols-3 gap-2 h-72">
        <div 
          className="col-span-2 rounded-2xl overflow-hidden border border-white/10 relative cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setZoomedImage(images[0])}
        >
          <img src={images[0]} alt="Trade" className="absolute inset-0 w-full h-full object-cover" />
        </div>
        <div className="col-span-1 grid grid-rows-2 gap-2">
          <div 
            className="rounded-2xl overflow-hidden border border-white/10 relative cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setZoomedImage(images[1])}
          >
            <img src={images[1]} alt="Trade" className="absolute inset-0 w-full h-full object-cover" />
          </div>
          <div 
            className="rounded-2xl overflow-hidden border border-white/10 relative cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setZoomedImage(images[2])}
          >
            <img src={images[2]} alt="Trade" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      </div>
    );
  };

  const activeTrades = activeTab === 'feed' ? feedTrades : trendingTrades;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between relative rounded-2xl p-1 bg-white/5 border border-white/10 backdrop-blur-xl">
        <button 
          onClick={() => onNavigate && onNavigate('friends', user.id)}
          className={`absolute -left-14 sm:-left-16 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-all border border-white/10 overflow-hidden hover:scale-105 active:scale-95`}
        >
          {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
             <img src={user.user_metadata?.avatar_url || user.user_metadata?.picture} className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover" />
          ) : (
             <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/10 flex items-center justify-center font-bold text-white rounded-full">{(user.user_metadata?.full_name || 'U')[0].toUpperCase()}</div>
          )}
        </button>
        <div className="flex w-full">
          <button 
            onClick={() => setActiveTab('feed')}
            className={`flex-1 py-3 text-sm font-bold flex justify-center items-center uppercase tracking-wider rounded-xl transition-all ${activeTab === 'feed' ? 'text-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-slate-400 hover:text-white'}`}
          >
            Social Feed
          </button>
          <div className="w-[1px] bg-white/10 my-2 mx-1" />
          <button 
            onClick={() => setActiveTab('trending')}
            className={`flex-1 py-3 text-sm font-bold flex justify-center items-center uppercase tracking-wider rounded-xl transition-all ${activeTab === 'trending' ? 'text-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-slate-400 hover:text-white'}`}
          >
            Trending
          </button>
        </div>
        
        <button 
          onClick={() => setShowNotifications(!showNotifications)}
          className={`absolute -right-16 top-1/2 -translate-y-1/2 p-3 rounded-full transition-all border ${showNotifications ? 'bg-white/20 border-white/30 text-white shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'}`}
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex items-center justify-between px-2">
        <p className="text-sm text-slate-400">
           {activeTab === 'feed' ? 'Trades from your friends and communities.' : 'Top trades across the platform.'}
        </p>
        <button onClick={loadData} className="text-xs text-slate-400 hover:text-white transition-colors">
          Refresh
        </button>
      </div>

      {showNotifications && (
        <div className="rounded-3xl border p-6 backdrop-blur-2xl animate-fade-in" style={panelStyle}>
          <h3 className="text-lg font-bold text-white mb-4">Notifications</h3>
          {notifications.length > 0 ? (
            <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
              {notifications.map((n) => (
                <div key={n.id} className="flex gap-3">
                  {n.actorAvatar ? (
                    <img src={n.actorAvatar} className="w-8 h-8 rounded-full border border-white/10 object-cover cursor-pointer hover:opacity-80 transition-opacity shrink-0" onClick={() => onNavigate && onNavigate('friends', n.user_id)} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-xs border border-white/10 cursor-pointer hover:bg-white/20 transition-colors shrink-0" onClick={() => onNavigate && onNavigate('friends', n.user_id)}>
                      {n.actorName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-white">
                      <span className="cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => onNavigate && onNavigate('friends', n.user_id)}>{n.actorName}</span>
                      <span className="text-slate-300 ml-1.5">{n.text}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">{new Date(n.date).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm py-8 text-center italic">
              No recent activity.
            </div>
          )}
        </div>
      )}
      
      {loading ? (
        <div className="flex items-center justify-center py-32 animate-in fade-in duration-500">
           <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
        </div>
      ) : activeTrades.length === 0 ? (
        <div className="text-center py-20 text-slate-500 rounded-3xl border border-white/5" style={panelStyle}>
          No recent trades found.
        </div>
      ) : (
        <div className="space-y-8">
          {activeTrades.map((t, idx) => {
             const isWin = Number(t.pnl) >= 0;
             const tradeLikes = likes[t.id] || { count: 0, likedByMe: false };
             const tradeComments = comments[t.id] || [];

             return (
               <div key={t.id || idx} className="rounded-3xl border overflow-hidden backdrop-blur-2xl shadow-2xl" style={panelStyle}>
                 <div className="p-5">
                   <div className="flex items-start justify-between">
                     <div className="flex items-center gap-3">
                       {t.friendAvatar ? (
                         <img src={t.friendAvatar} className="w-12 h-12 rounded-full border border-white/10 object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={() => onNavigate && onNavigate('friends', t.user_id)} />
                       ) : (
                         <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-lg border border-white/10 cursor-pointer hover:bg-white/20 transition-colors" onClick={() => onNavigate && onNavigate('friends', t.user_id)}>
                           {t.friendName?.substring(0, 2).toUpperCase()}
                         </div>
                       )}
                       <div>
                         <div className="font-bold text-white text-base cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => onNavigate && onNavigate('friends', t.user_id)}>{t.friendName}</div>
                         <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                           <span>{new Date(t.sold_timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                         </div>
                       </div>
                     </div>
                     
                     <div className={`text-right ${isWin ? 'text-emerald-400' : 'text-rose-400'} bg-black/20 px-3 py-1.5 rounded-xl border border-white/5`}>
                       <div className="text-xl font-bold flex items-center gap-1.5 justify-end">
                         {isWin ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                         {formatSignedCurrency(Number(t.pnl))}
                       </div>
                       <div className="text-[10px] opacity-75 uppercase tracking-wider mt-0.5 font-semibold">{t.direction} • {normalizeSymbol(t.symbol)}</div>
                     </div>
                   </div>
                   
                   {renderTradeImages(t.images)}
                   
                   <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                     <div className="flex items-center gap-4">
                        <button 
                           onClick={() => toggleLike(t.id)}
                           className={`flex items-center gap-2 transition-colors ${tradeLikes.likedByMe ? 'text-rose-500' : 'text-slate-400 hover:text-rose-400'}`}
                        >
                           <Heart className="h-5 w-5" fill={tradeLikes.likedByMe ? "currentColor" : "none"} />
                           <span className="text-xs font-semibold">{tradeLikes.count}</span>
                        </button>
                        <button 
                           onClick={() => setActiveCommentTrade(t)}
                           className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                        >
                           <MessageCircle className="h-5 w-5" />
                           <span className="text-xs font-semibold">{tradeComments.length}</span>
                        </button>
                     </div>
                     
                     <div className="flex flex-wrap gap-2 justify-end">
                       {t.entry_tags && t.entry_tags.length > 0 && (
                           t.entry_tags.slice(0,2).map((tag: string) => (
                             <span key={tag} className="px-2 py-0.5 text-[10px] uppercase tracking-wider rounded-md border border-white/10 bg-white/5 text-slate-300">
                               {tag}
                             </span>
                           ))
                       )}
                     </div>
                   </div>
                 </div>
               </div>
             );
          })}
        </div>
      )}

      {/* COMMENTS MODAL */}
      {activeCommentTrade && (
        <div className="fixed inset-0 z-[9999] p-4 flex items-center justify-center backdrop-blur-md bg-black/60">
          <div className="absolute inset-0" onClick={() => { setActiveCommentTrade(null); setReplyingTo(null); }} />
          <div className="w-full max-w-lg relative z-10 rounded-3xl border shadow-2xl flex flex-col max-h-[80vh] overflow-hidden bg-[#0f1115]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
               <h3 className="text-lg font-bold text-white">Comments</h3>
               <button onClick={() => { setActiveCommentTrade(null); setReplyingTo(null); }} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors">
                  <X className="h-5 w-5" />
               </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
               {comments[activeCommentTrade.id]?.length > 0 ? (
                 comments[activeCommentTrade.id].map(c => (
                    <div key={c.id} className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.username.substring(0, 2).toUpperCase()}
                       </div>
                       <div>
                          <div className="flex items-baseline gap-2">
                             <div className="font-semibold text-white text-sm">{c.username}</div>
                             <div className="text-[10px] text-slate-500">{new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                          </div>
                          <div className="text-slate-300 text-sm mt-0.5">
                             {c.replyTo && <span className="text-emerald-400 font-medium mr-1">@{c.replyTo}</span>}
                             {c.text}
                          </div>
                          <button 
                             onClick={() => setReplyingTo(c)}
                             className="text-[10px] text-slate-500 hover:text-white font-semibold mt-1 uppercase"
                          >
                             Reply
                          </button>
                       </div>
                    </div>
                 ))
               ) : (
                 <div className="text-center text-slate-500 py-10 italic text-sm">Be the first to comment.</div>
               )}
            </div>
            
            <div className="p-4 border-t border-white/10 bg-white/5">
               {replyingTo && (
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5">
                     <span>Replying to <span className="text-emerald-400 font-semibold">@{replyingTo.username}</span></span>
                     <button onClick={() => setReplyingTo(null)} className="hover:text-white"><X className="h-3 w-3" /></button>
                  </div>
               )}
               <div className="flex gap-2">
                  <input 
                     type="text"
                     value={newComment}
                     onChange={(e) => setNewComment(e.target.value)}
                     onKeyDown={(e) => { if (e.key === 'Enter') submitComment(); }}
                     placeholder="Add a comment..."
                     className="flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                  <button 
                     onClick={submitComment}
                     disabled={!newComment.trim()}
                     className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                     <Send className="h-5 w-5" />
                  </button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ZOOM IMAGE MODAL */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in" onClick={() => setZoomedImage(null)}>
          <button 
            className="absolute top-6 right-6 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
            onClick={() => setZoomedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={zoomedImage} 
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl border border-white/10" 
            alt="Zoomed Trade" 
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
