'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText } from 'lucide-react'

interface LessonNotesProps {
  lessonId: string
}

const STORAGE_KEY = (id: string) => `lesson-note-${id}`
const MAX_LENGTH = 2000

export function LessonNotes({ lessonId }: LessonNotesProps) {
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  // Restore from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY(lessonId))
    if (stored) setNote(stored)
    initialized.current = true
  }, [lessonId])

  // Auto-save with debounce (only after initial restore)
  useEffect(() => {
    if (!initialized.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY(lessonId), note)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }, 800)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [note, lessonId])

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Minhas anotações
        </h3>
        <span
          className={`text-xs transition-opacity duration-300 ${
            saved ? 'opacity-100 text-green-500' : 'opacity-0'
          }`}
        >
          Salvo
        </span>
      </div>
      <textarea
        value={note}
        onChange={(e) => {
          if (e.target.value.length <= MAX_LENGTH) setNote(e.target.value)
        }}
        placeholder="Escreva suas anotações sobre esta aula..."
        rows={5}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring min-h-[100px]"
      />
      <p className="text-xs text-muted-foreground text-right">
        {note.length}/{MAX_LENGTH} — salvo localmente no seu navegador
      </p>
    </div>
  )
}
