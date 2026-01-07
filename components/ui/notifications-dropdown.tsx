"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  FileCheck,
  FileX,
  AlertTriangle,
  Shield,
  Clock,
  Mail,
  Info,
  X
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Notification {
  id: string
  user_id: string
  company_id: string
  type: string
  title: string
  message: string
  link: string | null
  entity_type: string | null
  entity_id: string | null
  read: number
  created_at: string
}

const notificationIcons: Record<string, React.ReactNode> = {
  coc_received: <FileCheck className="h-4 w-4 text-blue-500" />,
  coc_verified: <Check className="h-4 w-4 text-green-500" />,
  coc_failed: <FileX className="h-4 w-4 text-red-500" />,
  exception_created: <Shield className="h-4 w-4 text-amber-500" />,
  exception_approved: <CheckCheck className="h-4 w-4 text-green-500" />,
  exception_expired: <Clock className="h-4 w-4 text-red-500" />,
  expiration_warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  communication_sent: <Mail className="h-4 w-4 text-blue-500" />,
  stop_work_risk: <AlertTriangle className="h-4 w-4 text-red-500" />,
  system: <Info className="h-4 w-4 text-slate-500" />,
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=10")
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error)
    }
  }, [])

  useEffect(() => {
    // Fetch notifications on mount
    fetchNotifications()

    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)

    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Refetch when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchNotifications()
    }
  }, [isOpen, fetchNotifications])

  const markAsRead = async (notificationIds: string[]) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds })
      })
      if (res.ok) {
        setNotifications(prev =>
          prev.map(n =>
            notificationIds.includes(n.id) ? { ...n, read: 1 } : n
          )
        )
        setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true })
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: 1 })))
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearAll = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/notifications", {
        method: "DELETE"
      })
      if (res.ok) {
        setNotifications([])
        setUnreadCount(0)
      }
    } catch (error) {
      console.error("Failed to clear notifications:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead([notification.id])
    }
    if (notification.link) {
      setIsOpen(false)
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="h-4 w-4 mr-2" aria-hidden="true" />
          Notifications
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
              aria-hidden="true"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end" role="dialog" aria-label="Notifications panel">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                disabled={isLoading}
                className="text-xs h-7"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={isLoading}
                className="text-xs h-7 text-red-500 hover:text-red-600"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto" role="list" aria-label="Notification list">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Bell className="h-12 w-12 mx-auto mb-3 text-slate-300" aria-hidden="true" />
              <p>No notifications</p>
              <p className="text-sm">You&apos;re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="p-3 border-t text-center">
            <Link
              href="/dashboard/notifications"
              className="text-sm text-primary hover:underline"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

function NotificationItem({
  notification,
  onClick
}: {
  notification: Notification
  onClick: () => void
}) {
  const icon = notificationIcons[notification.type] || notificationIcons.system
  const content = (
    <div
      className={cn(
        "flex items-start gap-3 p-3 hover:bg-slate-50 transition-colors cursor-pointer",
        !notification.read && "bg-blue-50/50"
      )}
      onClick={onClick}
      role="listitem"
      aria-label={`${notification.read ? "" : "Unread: "}${notification.title}. ${notification.message}. ${formatRelativeTime(notification.created_at)}`}
    >
      <div className="p-2 bg-slate-100 rounded-lg shrink-0" aria-hidden="true">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            "text-sm",
            !notification.read && "font-medium"
          )}>
            {notification.title}
          </p>
          {!notification.read && (
            <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" aria-hidden="true" />
          )}
        </div>
        <p className="text-sm text-slate-500 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </div>
  )

  if (notification.link) {
    return (
      <Link href={notification.link}>
        {content}
      </Link>
    )
  }

  return content
}
