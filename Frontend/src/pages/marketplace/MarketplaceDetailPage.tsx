import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Eye, User } from 'lucide-react'
import { marketplaceService } from '../../services/marketplace.service'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import { formatDate, getCategoryLabel } from '../../lib/utils'

export function MarketplaceDetailPage() {
  const { slug, postId } = useParams<{ slug: string; postId: string }>()

  const { data: post, isLoading } = useQuery({
    queryKey: ['marketplace-post', slug, postId],
    queryFn: () => marketplaceService.get(slug!, postId!),
    enabled: !!slug && !!postId,
  })

  if (isLoading) return <Spinner />
  if (!post) return <p className="text-center text-gray-500">Publicación no encontrada</p>

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        to={`/barrios/${slug}/marketplace`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft size={14} />
        Volver a clasificados
      </Link>

      {post.imageUrls?.length > 0 && (
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {post.imageUrls.map((url, i) => (
            <img key={i} src={url} alt={post.title} className="h-56 w-auto rounded-xl object-cover shrink-0" />
          ))}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="yellow">{getCategoryLabel(post.category)}</Badge>
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Eye size={12} /> {post.views} vistas
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{post.title}</h1>
        </div>
        {post.price && (
          <div className="text-right shrink-0 ml-4">
            <p className="text-2xl font-bold text-green-700">
              {post.currency ?? '$'} {post.price.toLocaleString('es-AR')}
            </p>
          </div>
        )}
      </div>

      <p className="text-gray-600 mb-6 leading-relaxed">{post.description}</p>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
          {post.seller.name[0]}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-800">{post.seller.name}</p>
          <p className="text-xs text-gray-400">Publicado el {formatDate(post.createdAt)}</p>
        </div>
      </div>
    </div>
  )
}
