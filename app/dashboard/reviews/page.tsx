"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { usePendingReviews, useUser } from "@/lib/hooks/use-api"
import {
  Clock,
  Search,
  AlertTriangle,
  ChevronRight,
  FileText,
  Building2,
  FolderOpen,
  Percent,
} from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

export default function ReviewsPage() {
  const router = useRouter()
  const { data: reviews = [], isLoading } = usePendingReviews()
  const { data: user } = useUser()
  const [searchQuery, setSearchQuery] = useState('')

  // Filter reviews by search
  const filteredReviews = reviews.filter(review => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) return true
    const query = trimmedQuery.toLowerCase()
    return (
      review.subcontractorName.toLowerCase().includes(query) ||
      review.projectName.toLowerCase().includes(query) ||
      (review.fileName && review.fileName.toLowerCase().includes(query))
    )
  })

  // Calculate stats
  const totalPending = reviews.length
  const oldestDays = reviews.length > 0 ? Math.max(...reviews.map(r => r.daysWaiting)) : 0
  const lowConfidenceCount = reviews.filter(r => r.confidenceScore && r.confidenceScore < 70).length

  const getConfidenceColor = (score: number | null) => {
    if (!score) return 'text-slate-500'
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-amber-600'
    return 'text-red-600'
  }

  const getDaysWaitingBadge = (days: number) => {
    if (days >= 7) return 'bg-red-100 text-red-700'
    if (days >= 3) return 'bg-amber-100 text-amber-700'
    return 'bg-slate-100 text-slate-600'
  }

  return (
    <>
      {/* Page Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Pending Reviews</h1>
            <p className="text-slate-500">Review certificates that require manual verification</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 md:p-8 lg:p-12 space-y-6">
        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by subcontractor, project, or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Pending</p>
                  <p className="text-3xl font-bold mt-1">{totalPending}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Oldest Waiting</p>
                  <p className="text-3xl font-bold mt-1">
                    {oldestDays > 0 ? `${oldestDays} days` : '-'}
                  </p>
                </div>
                <div className="p-2 bg-slate-100 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">Low Confidence</p>
                  <p className="text-3xl font-bold mt-1 text-amber-600">{lowConfidenceCount}</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Percent className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reviews List */}
        <Card>
          <CardHeader>
            <CardTitle>Review Queue</CardTitle>
            <CardDescription>
              Certificates requiring manual verification, sorted oldest first
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="divide-y">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-lg" />
                      <div>
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-64" />
                      </div>
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Clock className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p className="font-medium">No pending reviews</p>
                <p className="text-sm mt-1">
                  {reviews.length === 0
                    ? "All certificates have been reviewed"
                    : "No reviews match your search"
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredReviews.map((review) => (
                  <div
                    key={review.id}
                    className="py-4 flex items-center justify-between hover:bg-slate-50 -mx-6 px-6 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/reviews/${review.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/dashboard/reviews/${review.id}`)
                      }
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-slate-900">
                            {review.subcontractorName}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getDaysWaitingBadge(review.daysWaiting)}`}>
                            {review.daysWaiting === 0 ? 'Today' : `${review.daysWaiting}d waiting`}
                          </span>
                          {review.confidenceScore && (
                            <span className={`text-xs font-medium ${getConfidenceColor(review.confidenceScore)}`}>
                              {review.confidenceScore}% confidence
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <FolderOpen className="h-3 w-3" />
                            {review.projectName}
                          </span>
                          {review.fileName && (
                            <>
                              <span>•</span>
                              <span>{review.fileName}</span>
                            </>
                          )}
                          {review.lowConfidenceFields.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="text-amber-600">
                                {review.lowConfidenceFields.length} uncertain field{review.lowConfidenceFields.length > 1 ? 's' : ''}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        Review
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
