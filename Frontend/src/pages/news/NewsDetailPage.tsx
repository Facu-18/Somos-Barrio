import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { newsService } from '../../services/news.service'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { formatDate, getCategoryLabel } from '../../lib/utils'

export function NewsDetailPage() {
  const { slug, newsSlug } = useParams<{ slug: string; newsSlug: string }>()

  const { data: news, isLoading } = useQuery({
    queryKey: ['news', slug, newsSlug],
    queryFn: () => newsService.get(slug!, newsSlug!),
    enabled: !!slug && !!newsSlug,
  })

  if (isLoading) return <Spinner />
  if (!news) return <p className="text-center text-gray-500">Noticia no encontrada</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/barrios/${slug}/news`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Volver a noticias
      </Link>

      {news.imageUrl && (
        <img
          src={news.imageUrl}
          alt={news.title}
          className="w-full h-64 object-cover rounded-2xl mb-6"
        />
      )}

      <div className="flex items-center gap-3 mb-4">
        <Badge variant="blue">{getCategoryLabel(news.category)}</Badge>
        {news.publishedAt && (
          <span className="text-sm text-gray-400">{formatDate(news.publishedAt)}</span>
        )}
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-3">{news.title}</h1>

      {news.summary && (
        <p className="text-lg text-gray-600 mb-6 border-l-4 border-green-500 pl-4">{news.summary}</p>
      )}

      <div className="flex items-center gap-2 mb-8 pb-6 border-b border-gray-200">
        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-xs font-bold">
          {news.author.name[0]}
        </div>
        <span className="text-sm text-gray-600">Por <strong>{news.author.name}</strong></span>
      </div>

      <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
        {news.content}
      </div>
    </div>
  )
}
