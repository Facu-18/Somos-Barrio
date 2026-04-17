import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare } from 'lucide-react'
import { forumService } from '../../services/forum.service'
import { Spinner } from '../../components/ui/Spinner'

export function ForumPage() {
  const { slug } = useParams<{ slug: string }>()

  const { data: subforums, isLoading } = useQuery({
    queryKey: ['forum-subforums', slug],
    queryFn: () => forumService.listSubforums(slug!),
    enabled: !!slug,
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Foro del barrio</h1>

      {subforums?.length ? (
        <div className="flex flex-col gap-3">
          {subforums.map((sf) => (
            <Link
              key={sf.id}
              to={`/barrios/${slug}/forum/${sf.slug}`}
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-green-300 transition-all"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors">
                    {sf.name}
                  </h2>
                  {sf.description && (
                    <p className="text-sm text-gray-500 mt-0.5">{sf.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-400 shrink-0 ml-4">
                  <MessageSquare size={14} />
                  {sf._count?.threads ?? 0} hilos
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={40} className="mx-auto mb-3 opacity-50" />
          <p>No hay subforos todavía.</p>
        </div>
      )}
    </div>
  )
}
