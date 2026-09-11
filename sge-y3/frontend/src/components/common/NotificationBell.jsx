import { Bell } from "lucide-react";

import { useNotifications } from "@/hooks/useNotifications";
import { Popover, PopoverClose, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "à l'instant";
  if (diffMinutes < 60) return `il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `il y a ${diffDays} j`;
}

export default function NotificationBell({ onNavigate, triggerClassName = "text-slate-500 hover:text-[#0F3A63]" }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) {
      markRead(notification._id);
    }
    if (notification.link && typeof onNavigate === "function") {
      onNavigate(notification);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`relative ${triggerClassName}`} aria-label="Notifications">
          <Bell size={18} />
          {unreadCount > 0 ? (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-3">
          <p className="text-sm font-semibold text-[#0F3A63]">Notifications</p>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs font-medium text-[#0F3A63] hover:underline"
            >
              Tout marquer comme lu
            </button>
          ) : null}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification pour le moment.</p>
          ) : (
            notifications.map((notification) => (
              <PopoverClose key={notification._id} asChild>
                <button
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`block w-full border-b border-foreground/5 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-foreground/5 ${
                    notification.is_read ? "text-slate-500" : "font-medium text-[#0F3A63]"
                  }`}
                >
                  <p>{notification.message}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(notification.created_at)}</p>
                </button>
              </PopoverClose>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
