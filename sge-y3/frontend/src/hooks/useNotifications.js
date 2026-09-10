import { useCallback, useEffect, useRef, useState } from "react";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/api/notifications";

const POLL_INTERVAL_MS = 25000;

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const [{ notifications: items }, { count }] = await Promise.all([
        getNotifications(),
        getUnreadNotificationCount(),
      ]);
      if (mountedRef.current) {
        setNotifications(items || []);
        setUnreadCount(count || 0);
      }
    } catch {
      // Silencieux : le prochain polling réessaiera.
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const intervalId = setInterval(refresh, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [refresh]);

  const markRead = useCallback(
    async (id) => {
      setNotifications((current) =>
        current.map((notification) =>
          notification._id === id ? { ...notification, is_read: true } : notification
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await markNotificationRead(id);
      } catch {
        refresh();
      }
    },
    [refresh]
  );

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead();
    } catch {
      refresh();
    }
  }, [refresh]);

  return { notifications, unreadCount, markRead, markAllRead, refresh };
}
