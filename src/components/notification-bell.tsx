"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  title: string;
  body?: string | null;
  message?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  created_at: string;
  read_at: string | null;
};

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function loadNotifications() {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || !active) return;
      setUserId(userId);

      const refreshCount = async () => {
        const { count } = await supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null);
        if (active) setUnreadCount(count ?? 0);
      };

      await refreshCount();
      channel = supabase
        .channel(`notifications-${userId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, refreshCount)
        .subscribe();
    }

    void loadNotifications();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  async function loadNotifications() {
    if (!userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, title, body, message, entity_type, entity_id, created_at, read_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8);
    setNotifications((data ?? []) as Notification[]);
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await loadNotifications();
  }

  async function markAllRead() {
    if (!userId) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
    setUnreadCount(0);
    setNotifications((current) => current.map((notification) => ({ ...notification, read_at: new Date().toISOString() })));
  }

  return (
    <div className="relative">
      <button type="button" onClick={toggleOpen} className="icon-button relative" aria-label={unreadCount ? `${unreadCount} unread notifications` : "Notifications"} aria-expanded={open} title="Notifications">
        <Bell className="size-[19px]" />
        {unreadCount > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-4 text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>
      {open && <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-white/10"><p className="text-sm font-black">Notifications</p>{unreadCount > 0 && <button type="button" onClick={markAllRead} className="flex items-center gap-1 text-[11px] font-bold text-orange-500"><CheckCheck className="size-3.5" /> Mark all read</button>}</div>
        {notifications.length === 0 ? <p className="p-6 text-center text-xs text-slate-500">No notifications yet.</p> : <div className="max-h-80 overflow-y-auto">{notifications.map((notification) => { const content = <><p className="text-xs font-black">{notification.title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{notification.body ?? notification.message}</p><time className="mt-2 block text-[10px] text-slate-400">{new Date(notification.created_at).toLocaleDateString()}</time></>; return notification.entity_type === "order" && notification.entity_id ? <Link key={notification.id} href={`/account/orders/${notification.entity_id}`} onClick={() => setOpen(false)} className={`block border-b border-slate-100 px-4 py-3 transition hover:bg-orange-50 dark:border-white/10 dark:hover:bg-white/5 ${!notification.read_at ? "bg-orange-50/60 dark:bg-orange-500/5" : ""}`}>{content}</Link> : <div key={notification.id} className={`border-b border-slate-100 px-4 py-3 dark:border-white/10 ${!notification.read_at ? "bg-orange-50/60 dark:bg-orange-500/5" : ""}`}>{content}</div>; })}</div>}
      </div>}
    </div>
  );
}
