import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, CheckCircle, MapPin, Phone, Mail, Globe, Star } from 'lucide-react'
import { businessesService } from '../../services/businesses.service'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Textarea'
import { formatDate, formatRelative, getCategoryLabel, getErrorMessage } from '../../lib/utils'
import { useAuthStore } from '../../store/auth'

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}>
          <Star
            size={22}
            className={n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}
          />
        </button>
      ))}
    </div>
  )
}

export function BusinessDetailPage() {
  const { slug, businessSlug } = useParams<{ slug: string; businessSlug: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewError, setReviewError] = useState('')

  const { data: business, isLoading } = useQuery({
    queryKey: ['business', slug, businessSlug],
    queryFn: () => businessesService.get(slug!, businessSlug!),
    enabled: !!slug && !!businessSlug,
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', slug, businessSlug],
    queryFn: () => businessesService.listReviews(slug!, businessSlug!),
    enabled: !!slug && !!businessSlug,
  })

  const reviewMutation = useMutation({
    mutationFn: () => businessesService.createReview(slug!, businessSlug!, { rating, comment: comment || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', slug, businessSlug] })
      setComment('')
      setRating(5)
      setReviewError('')
    },
    onError: (err) => setReviewError(getErrorMessage(err)),
  })

  if (isLoading) return <Spinner />
  if (!business) return <p className="text-center text-gray-500">Comercio no encontrado</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/barrios/${slug}/businesses`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Volver a comercios
      </Link>

      {business.imageUrl && (
        <img src={business.imageUrl} alt={business.name} className="w-full h-56 object-cover rounded-2xl mb-6" />
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-bold text-gray-900">{business.name}</h1>
            {business.verified && (
              <CheckCircle size={22} className="text-green-600" title="Verificado" />
            )}
          </div>
          <Badge variant="green">{getCategoryLabel(business.category)}</Badge>
        </div>
        {reviews?.averageRating && (
          <div className="flex items-center gap-1 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5">
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
            <span className="font-semibold text-yellow-700">{reviews.averageRating}</span>
            <span className="text-xs text-yellow-600">({reviews.total})</span>
          </div>
        )}
      </div>

      {business.description && (
        <p className="text-gray-600 mb-6">{business.description}</p>
      )}

      <div className="grid gap-3 mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <MapPin size={15} className="text-gray-400 shrink-0" />
          {business.address}
        </div>
        {business.phone && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone size={15} className="text-gray-400 shrink-0" />
            {business.phone}
          </div>
        )}
        {business.email && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Mail size={15} className="text-gray-400 shrink-0" />
            <a href={`mailto:${business.email}`} className="hover:text-green-700">{business.email}</a>
          </div>
        )}
        {business.website && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Globe size={15} className="text-gray-400 shrink-0" />
            <a href={business.website} target="_blank" rel="noopener noreferrer" className="hover:text-green-700 truncate">
              {business.website}
            </a>
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Reseñas {reviews?.total ? `(${reviews.total})` : ''}
        </h2>

        {user && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Dejá tu reseña</p>
            <StarRating value={rating} onChange={setRating} />
            <Textarea
              className="mt-3"
              rows={3}
              placeholder="Comentario (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            {reviewError && <p className="text-xs text-red-500 mt-1">{reviewError}</p>}
            <Button
              size="sm"
              className="mt-3"
              onClick={() => reviewMutation.mutate()}
              loading={reviewMutation.isPending}
            >
              Publicar reseña
            </Button>
          </div>
        )}

        {reviews?.items.length ? (
          <div className="flex flex-col gap-4">
            {reviews.items.map((r) => (
              <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">
                    {r.user.name[0]}
                  </div>
                  <span className="text-sm font-medium">{r.user.name}</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} size={13} className={n <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{formatRelative(r.createdAt)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 ml-9">{r.comment}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Todavía no hay reseñas.</p>
        )}
      </div>
    </div>
  )
}
