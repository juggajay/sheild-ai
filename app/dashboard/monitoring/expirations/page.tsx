"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import {
  Calendar, ChevronLeft, ChevronRight, AlertTriangle, Clock, CheckCircle, Send,
  FileText, Building2, Loader2, XCircle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ExpirationRecord {
  id: string
  subcontractor_id: string
  subcontractor_name: string
  project_id: string
  project_name: string
  coc_document_id: string
  file_name: string | null
  policy_number: string
  insurer_name: string
  expiry_date: string
  days_until_expiry: number
  status: 'expired' | 'expiring_soon' | 'valid'
}

interface CalendarDay {
  date: Date
  isCurrentMonth: boolean
  isToday: boolean
  expirations: ExpirationRecord[]
}

const STATUS_COLORS = {
  expired: { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-100' },
  expiring_soon: { bg: 'bg-amber-500', text: 'text-amber-700', light: 'bg-amber-100' },
  valid: { bg: 'bg-green-500', text: 'text-green-700', light: 'bg-green-100' }
}

export default function ExpirationsCalendarPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [expirations, setExpirations] = useState<ExpirationRecord[]>([])
  const [byDate, setByDate] = useState<Record<string, ExpirationRecord[]>>({})
  const [summary, setSummary] = useState({ total: 0, expired: 0, expiringSoon: 0, valid: 0 })
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedExpirations, setSelectedExpirations] = useState<ExpirationRecord[]>([])
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [selectedForReminder, setSelectedForReminder] = useState<Set<string>>(new Set())
  const [isSendingReminders, setIsSendingReminders] = useState(false)

  useEffect(() => {
    fetchExpirations()
  }, [currentMonth])

  const fetchExpirations = async () => {
    try {
      setIsLoading(true)

      // Calculate date range for the current month view (+/- 1 month for calendar display)
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 2, 0)

      const response = await fetch(
        `/api/expirations?startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`
      )

      if (!response.ok) throw new Error('Failed to fetch expirations')

      const data = await response.json()
      setExpirations(data.expirations)
      setByDate(data.byDate)
      setSummary(data.summary)
    } catch (error) {
      console.error('Error fetching expirations:', error)
      toast({
        title: "Error",
        description: "Failed to load expirations data",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()

    // First day of the month
    const firstDay = new Date(year, month, 1)
    // Last day of the month
    const lastDay = new Date(year, month + 1, 0)

    // Day of week for first day (0 = Sunday)
    const startDayOfWeek = firstDay.getDay()

    // Total days to show (including padding)
    const daysInMonth = lastDay.getDate()
    const totalDays = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7

    const days: CalendarDay[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    for (let i = 0; i < totalDays; i++) {
      const dayOffset = i - startDayOfWeek
      const date = new Date(year, month, dayOffset + 1)
      const dateKey = date.toISOString().split('T')[0]

      days.push({
        date,
        isCurrentMonth: date.getMonth() === month,
        isToday: date.getTime() === today.getTime(),
        expirations: byDate[dateKey] || []
      })
    }

    return days
  }, [currentMonth, byDate])

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const handleDateClick = (day: CalendarDay) => {
    if (day.expirations.length > 0) {
      setSelectedDate(day.date.toISOString().split('T')[0])
      setSelectedExpirations(day.expirations)
      setSelectedForReminder(new Set())
      setIsDetailsOpen(true)
    }
  }

  const toggleReminderSelection = (id: string) => {
    const newSelection = new Set(selectedForReminder)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedForReminder(newSelection)
  }

  const selectAllForReminder = () => {
    if (selectedForReminder.size === selectedExpirations.length) {
      setSelectedForReminder(new Set())
    } else {
      setSelectedForReminder(new Set(selectedExpirations.map(e => e.id)))
    }
  }

  const handleSendReminders = async () => {
    if (selectedForReminder.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one item to send reminders",
        variant: "destructive"
      })
      return
    }

    setIsSendingReminders(true)
    try {
      const response = await fetch('/api/expirations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expirationIds: Array.from(selectedForReminder) })
      })

      if (!response.ok) throw new Error('Failed to send reminders')

      const data = await response.json()
      toast({
        title: "Reminders Sent",
        description: `Successfully sent ${data.sentCount} reminder(s)`
      })

      setSelectedForReminder(new Set())
      setIsDetailsOpen(false)
    } catch (error) {
      console.error('Error sending reminders:', error)
      toast({
        title: "Error",
        description: "Failed to send reminders",
        variant: "destructive"
      })
    } finally {
      setIsSendingReminders(false)
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-2">
          <Link href="/dashboard" className="hover:text-primary">Dashboard</Link>
          <span>/</span>
          <span>Monitoring</span>
          <span>/</span>
          <span className="text-slate-900">Expirations</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="h-6 w-6" />
              Expiration Calendar
            </h1>
            <p className="text-slate-600">Track and manage upcoming certificate expirations</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Tracked</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-slate-500">Certificates</p>
          </CardContent>
        </Card>

        <Card className={summary.expired > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{summary.expired}</div>
            <p className="text-xs text-slate-500">Need renewal</p>
          </CardContent>
        </Card>

        <Card className={summary.expiringSoon > 0 ? 'border-amber-200 bg-amber-50' : ''}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{summary.expiringSoon}</div>
            <p className="text-xs text-slate-500">Within 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valid</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.valid}</div>
            <p className="text-xs text-slate-500">Current certificates</p>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <CardDescription>
            Click on a date to view expiration details and send reminders
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-sm font-medium text-slate-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const hasExpirations = day.expirations.length > 0
              const hasExpired = day.expirations.some(e => e.status === 'expired')
              const hasExpiringSoon = day.expirations.some(e => e.status === 'expiring_soon')

              return (
                <div
                  key={index}
                  onClick={() => handleDateClick(day)}
                  className={`
                    min-h-[80px] p-2 rounded-md border transition-colors
                    ${!day.isCurrentMonth ? 'bg-slate-50 text-slate-400' : 'bg-white'}
                    ${day.isToday ? 'border-primary border-2' : 'border-slate-200'}
                    ${hasExpirations ? 'cursor-pointer hover:bg-slate-50' : ''}
                  `}
                >
                  <div className={`text-sm font-medium ${day.isToday ? 'text-primary' : ''}`}>
                    {day.date.getDate()}
                  </div>
                  {hasExpirations && (
                    <div className="mt-1 space-y-1">
                      {hasExpired && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS.expired.bg}`} />
                          <span className={STATUS_COLORS.expired.text}>
                            {day.expirations.filter(e => e.status === 'expired').length} expired
                          </span>
                        </div>
                      )}
                      {hasExpiringSoon && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS.expiring_soon.bg}`} />
                          <span className={STATUS_COLORS.expiring_soon.text}>
                            {day.expirations.filter(e => e.status === 'expiring_soon').length} expiring
                          </span>
                        </div>
                      )}
                      {day.expirations.some(e => e.status === 'valid') && (
                        <div className="flex items-center gap-1 text-xs">
                          <div className={`w-2 h-2 rounded-full ${STATUS_COLORS.valid.bg}`} />
                          <span className={STATUS_COLORS.valid.text}>
                            {day.expirations.filter(e => e.status === 'valid').length} valid
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_COLORS.expired.bg}`} />
              <span>Expired</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_COLORS.expiring_soon.bg}`} />
              <span>Expiring Soon (30 days)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${STATUS_COLORS.valid.bg}`} />
              <span>Valid</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Expirations on {selectedDate && new Date(selectedDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </DialogTitle>
            <DialogDescription>
              {selectedExpirations.length} certificate(s) expiring on this date
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {selectedExpirations.map(exp => {
              const statusColors = STATUS_COLORS[exp.status]
              return (
                <div
                  key={exp.id}
                  className={`p-4 rounded-lg border ${
                    selectedForReminder.has(exp.id) ? 'border-primary bg-primary/5' : 'border-slate-200'
                  }`}
                  onClick={() => toggleReminderSelection(exp.id)}
                >
                  <div className="flex items-start justify-between cursor-pointer">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedForReminder.has(exp.id)}
                        onChange={() => toggleReminderSelection(exp.id)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-slate-500" />
                          {exp.subcontractor_name}
                        </div>
                        <div className="text-sm text-slate-500">{exp.project_name}</div>
                        <div className="text-sm text-slate-500 mt-1">
                          Policy: {exp.policy_number} • {exp.insurer_name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusColors.light} ${statusColors.text}`}>
                        {exp.status === 'expired' ? 'Expired' :
                         exp.status === 'expiring_soon' ? `${exp.days_until_expiry} days left` :
                         'Valid'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={selectAllForReminder}>
              {selectedForReminder.size === selectedExpirations.length ? 'Deselect All' : 'Select All'}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
                Close
              </Button>
              <Button
                onClick={handleSendReminders}
                disabled={selectedForReminder.size === 0 || isSendingReminders}
              >
                {isSendingReminders ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Reminders ({selectedForReminder.size})
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
