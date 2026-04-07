'use client'

import { useTransition, useRef } from 'react'
import { MessageCircle, Send, Loader2, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createLessonCommentAction } from '@/modules/course/actions'

interface Comment {
  id: string
  content: string
  createdAt: Date
  user: { name: string | null; image: string | null }
}

interface LessonCommentsProps {
  lessonId: string
  initialComments: Comment[]
  canComment: boolean
}

export function LessonComments({
  lessonId,
  initialComments,
  canComment,
}: LessonCommentsProps) {
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createLessonCommentAction(formData)
      formRef.current?.reset()
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-primary" />
        Comentários ({initialComments.length})
      </h3>

      {/* Form */}
      {canComment && (
        <form ref={formRef} action={handleSubmit} className="space-y-2">
          <input type="hidden" name="lessonId" value={lessonId} />
          <textarea
            name="content"
            placeholder="Deixe um comentário, dúvida ou observação..."
            rows={3}
            maxLength={1000}
            required
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending}
              className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm inline-flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              Comentar
            </button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-3">
        {initialComments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum comentário ainda. Seja o primeiro!
          </p>
        )}
        {initialComments.map((comment) => (
          <div
            key={comment.id}
            className="flex gap-3 rounded-lg border border-border bg-accent/10 p-3"
          >
            <div className="w-7 h-7 rounded-full bg-accent border border-border flex items-center justify-center shrink-0">
              {comment.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={comment.user.image}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">
                  {comment.user.name ?? 'Usuário'}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </div>
              <p className="text-sm text-foreground whitespace-pre-line break-words">
                {comment.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
