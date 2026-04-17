import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Mail, Send, Check } from 'lucide-react'
import { messagesService } from '../services/messages.service'
import { Spinner } from '../components/ui/Spinner'
import { Button } from '../components/ui/Button'
import { Textarea } from '../components/ui/Textarea'
import { Input } from '../components/ui/Input'
import { formatRelative, getErrorMessage } from '../lib/utils'
import { cn } from '../lib/utils'

export function MessagesPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [showCompose, setShowCompose] = useState(false)
  const [receiverId, setReceiverId] = useState('')
  const [content, setContent] = useState('')
  const [sendError, setSendError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['messages', tab],
    queryFn: () => messagesService.list(tab),
  })

  const sendMutation = useMutation({
    mutationFn: () => messagesService.send({ receiverId, content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      setReceiverId('')
      setContent('')
      setShowCompose(false)
      setSendError('')
    },
    onError: (err) => setSendError(getErrorMessage(err)),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => messagesService.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['messages', 'inbox'] }),
  })

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Mensajes</h1>
        <Button size="sm" onClick={() => setShowCompose(!showCompose)}>
          <Send size={14} />
          Nuevo mensaje
        </Button>
      </div>

      {showCompose && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Redactar mensaje</h2>
          <div className="flex flex-col gap-3">
            <Input
              label="ID del destinatario"
              placeholder="ID del usuario..."
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
            />
            <Textarea
              label="Mensaje"
              rows={4}
              placeholder="Escribí tu mensaje..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            {sendError && <p className="text-xs text-red-500">{sendError}</p>}
            <div className="flex gap-2">
              <Button onClick={() => sendMutation.mutate()} loading={sendMutation.isPending}>
                Enviar
              </Button>
              <Button variant="secondary" onClick={() => setShowCompose(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex border-b border-gray-200 mb-6">
        {(['inbox', 'sent'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            {t === 'inbox' ? 'Recibidos' : 'Enviados'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Spinner />
      ) : data?.items.length ? (
        <div className="flex flex-col gap-3">
          {data.items.map((m) => (
            <div
              key={m.id}
              className={cn(
                'bg-white border rounded-xl p-4 transition-colors',
                !m.readAt && tab === 'inbox' ? 'border-green-300 bg-green-50' : 'border-gray-200'
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-bold">
                      {(tab === 'inbox' ? m.sender : m.receiver).name[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-800">
                      {tab === 'inbox' ? `De: ${m.sender.name}` : `Para: ${m.receiver.name}`}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">{formatRelative(m.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-600 ml-9">{m.content}</p>
                  {m.post && (
                    <p className="text-xs text-gray-400 ml-9 mt-1">Re: {m.post.title}</p>
                  )}
                </div>
                {!m.readAt && tab === 'inbox' && (
                  <button
                    onClick={() => markReadMutation.mutate(m.id)}
                    className="p-1.5 text-green-600 hover:bg-green-100 rounded-lg transition-colors shrink-0"
                    title="Marcar como leído"
                  >
                    <Check size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-gray-400">
          <Mail size={40} className="mx-auto mb-3 opacity-50" />
          <p>{tab === 'inbox' ? 'No tenés mensajes recibidos.' : 'No enviaste mensajes.'}</p>
        </div>
      )}
    </div>
  )
}
