import { Link, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Calendar, MapPin, Users, Monitor } from 'lucide-react'
import { eventsService } from '../../services/events.service'
import { Spinner } from '../../components/ui/Spinner'
import { Button } from '../../components/ui/Button'
import { formatDate } from '../../lib/utils'
import { useAuthStore } from '../../store/auth'
import type { EventRsvpStatus } from '../../types'

const RSVP_OPTIONS: { value: EventRsvpStatus; label: string }[] = [
  { value: 'GOING', label: 'Voy' },
  { value: 'MAYBE', label: 'Tal vez' },
  { value: 'NOT_GOING', label: 'No voy' },
]

export function EventDetailPage() {
  const { slug, eventId } = useParams<{ slug: string; eventId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', slug, eventId],
    queryFn: () => eventsService.get(slug!, eventId!),
    enabled: !!slug && !!eventId,
  })

  const rsvpMutation = useMutation({
    mutationFn: (status: EventRsvpStatus) => eventsService.rsvp(slug!, eventId!, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['event', slug, eventId] }),
  })

  if (isLoading) return <Spinner />
  if (!event) return <p className="text-center text-gray-500">Evento no encontrado</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/barrios/${slug}/events`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Volver a eventos
      </Link>

      {event.imageUrl && (
        <img src={event.imageUrl} alt={event.title} className="w-full h-64 object-cover rounded-2xl mb-6" />
      )}

      <h1 className="text-3xl font-bold text-gray-900 mb-4">{event.title}</h1>

      <div className="grid gap-3 mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Calendar size={15} className="text-gray-400 shrink-0" />
          <span>
            {formatDate(event.startDate)}
            {event.endDate && ` → ${formatDate(event.endDate)}`}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={15} className="text-gray-400 shrink-0" />
            {event.location}
          </div>
        )}
        {event.isOnline && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Monitor size={15} className="shrink-0" />
            Evento online
          </div>
        )}
        {event._count?.rsvps !== undefined && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users size={15} className="text-gray-400 shrink-0" />
            {event._count.rsvps} personas confirmadas
            {event.maxAttendees && ` / ${event.maxAttendees} máximo`}
          </div>
        )}
      </div>

      <p className="text-gray-600 mb-6 leading-relaxed">{event.description}</p>

      {user && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-gray-700 mb-3">¿Vas a ir?</p>
          <div className="flex gap-2">
            {RSVP_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant="secondary"
                size="sm"
                onClick={() => rsvpMutation.mutate(opt.value)}
                loading={rsvpMutation.isPending}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">
          {event.organizer.name[0]}
        </div>
        Organizado por <strong className="text-gray-700">{event.organizer.name}</strong>
      </div>
    </div>
  )
}
