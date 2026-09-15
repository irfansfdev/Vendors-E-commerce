"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = { id: string; title: string; body?: string | null; message?: string | null; entity_type?: string | null; entity_id?: string | null; created_at: string; read_at: string | null };

export function NotificationBell() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async (user: string | null = userId) => {
    if (!user) return;
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase.from("notifications").select("id,title,body,message,entity_type,entity_id,created_at,read_at").eq("user_id", user).order("created_at", { ascending: false }).limit(8),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user).is("read_at", null),
    ]);
    setNotifications((data ?? []) as Notification[]);
    setUnreadCount(count ?? 0);
  }, [userId]);

  useEffect(() => {
    let active = true;
    async function start() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (active && data.user) {
        setUserId(data.user.id);
        await refresh(data.user.id);
      }
    }
    void start();
    return () => { active = false; };
  }, [refresh]);

  async function markAllRead() { if (!userId) return; const supabase = createClient(); await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null); await refresh(userId); }
  const linkFor = (notification: Notification) => notification.entity_type === "product" && notification.entity_id ? `/product/${notification.entity_id}` : notification.entity_type === "order" && notification.entity_id ? `/account/orders/${notification.entity_id}` : null;

  return <div className="relative"><button type="button" onClick={() => { setOpen((value) => !value); if (!open) void refresh(); }} className="icon-button relative" aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"} title="Notifications"><Bell className="size-[19px]" />{unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-4 text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>{open && <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10"><p className="text-sm font-black">Notifications</p>{unreadCount > 0 && <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-bold text-orange-500"><CheckCheck className="size-3.5" /> Mark all read</button>}</div>{notifications.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p> : <div className="max-h-80 overflow-y-auto">{notifications.map((notification) => { const content = <><p className="text-xs font-black">{notification.title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{notification.body ?? notification.message}</p><time className="mt-2 block text-[10px] text-slate-400">{new Date(notification.created_at).toLocaleDateString()}</time></>; const href = linkFor(notification); const className = `block border-b border-slate-100 px-4 py-3 transition hover:bg-orange-50 dark:border-white/10 dark:hover:bg-white/5 ${!notification.read_at ? "bg-orange-50/60 dark:bg-orange-500/5" : ""}`; return href ? <Link key={notification.id} href={href} onClick={() => setOpen(false)} className={className}>{content}</Link> : <div key={notification.id} className={className}>{content}</div>; })}</div>}</div>}</div>;
}
