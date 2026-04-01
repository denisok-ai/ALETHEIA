'use client';

/**
 * AI-тьютор: переключатель + список бесед с просмотром переписки.
 */
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Bot, MessageCircle, Loader2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import { EmptyState } from '@/components/ui/EmptyState';

type ConversationRow = {
  id: string;
  userId: string;
  userEmail: string;
  displayName: string | null;
  lessonId: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

type MessageRow = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

export function CourseAiTutorBlock({
  courseId,
  initialEnabled,
}: {
  courseId: string;
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [convLoading, setConvLoading] = useState(true);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [convDetail, setConvDetail] = useState<{
    id: string;
    userEmail: string;
    displayName: string | null;
    lessonId: string | null;
    messages: MessageRow[];
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function handleToggle() {
    setToggleLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiTutorEnabled: !enabled }),
      });
      if (!res.ok) throw new Error(await res.text());
      setEnabled(!enabled);
      toast.success(enabled ? 'AI-тьютор отключён для курса' : 'AI-тьютор включён для курса');
    } catch {
      toast.error('Ошибка сохранения');
    }
    setToggleLoading(false);
  }

  async function loadConversations() {
    setConvLoading(true);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/ai-conversations?pageSize=20`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { conversations: ConversationRow[] };
      setConversations(data.conversations ?? []);
    } catch {
      toast.error('Ошибка загрузки бесед');
    } finally {
      setConvLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, [courseId]);

  async function openConversation(convId: string) {
    setSelectedConvId(convId);
    setDetailLoading(true);
    setConvDetail(null);
    try {
      const res = await fetch(`/api/portal/admin/courses/${courseId}/ai-conversations/${convId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        id: string;
        userEmail: string;
        displayName: string | null;
        lessonId: string | null;
        messages: MessageRow[];
      };
      setConvDetail(data);
    } catch {
      toast.error('Ошибка загрузки беседы');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <h2 className="text-lg font-semibold text-[var(--portal-text)] flex items-center gap-2">
        <Bot className="h-5 w-5 text-[#6366F1]" />
        AI-тьютор в плеере
      </h2>
      <p className="mt-1 text-sm text-[var(--portal-text-muted)]">
        Если включён, студенты видят кнопку чата с AI-тьютором при прохождении курса.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'Отключить AI-тьютор для курса' : 'Включить AI-тьютор для курса'}
          disabled={toggleLoading}
          onClick={handleToggle}
          className={cn(
            'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2 disabled:opacity-50',
            enabled ? 'bg-[#6366F1]' : 'bg-[#E2E8F0]'
          )}
        >
          <span
            className={cn(
              'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition',
              enabled ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </button>
        <Label className="text-sm font-medium text-[var(--portal-text)] cursor-pointer" onClick={handleToggle}>
          {enabled ? 'Включён' : 'Выключен'}
        </Label>
      </div>

      <div className="mt-4 border-t border-[#E2E8F0] pt-4">
        <h3 className="text-sm font-medium text-[var(--portal-text)] mb-2">Беседы с тьютором</h3>
        {convLoading ? (
          <div className="flex items-center gap-2 text-[var(--portal-text-muted)] text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        ) : conversations.length === 0 ? (
          <EmptyState
            className="py-4"
            title="Нет бесед"
            description="Беседы студентов с AI-тьютором появятся здесь."
            icon={<MessageCircle className="h-8 w-8" />}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E2E8F0] max-h-48 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Участник</TableHead>
                  <TableHead className="text-xs">Урок</TableHead>
                  <TableHead className="text-xs">Сообщений</TableHead>
                  <TableHead className="text-xs">Дата</TableHead>
                  <TableHead className="w-20 text-xs">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      <Link
                        href={`/portal/admin/users/${c.userId}`}
                        className="text-[#6366F1] hover:underline"
                      >
                        {c.displayName || c.userEmail}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-[var(--portal-text-muted)]">
                      {c.lessonId ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{c.messageCount}</TableCell>
                    <TableCell className="text-sm text-[var(--portal-text-muted)]">
                      {format(new Date(c.updatedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => openConversation(c.id)}
                      >
                        Просмотр
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!selectedConvId} onOpenChange={(open) => !open && setSelectedConvId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Переписка с AI-тьютором</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--portal-text-muted)]" />
            </div>
          ) : convDetail ? (
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              <p className="text-sm text-[var(--portal-text-muted)]">
                {convDetail.displayName || convDetail.userEmail}
                {convDetail.lessonId && ` · Урок: ${convDetail.lessonId}`}
              </p>
              {convDetail.messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'rounded-lg px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'ml-4 bg-[#EEF2FF] text-[var(--portal-text)]'
                      : 'mr-4 bg-[#F8FAFC] text-[var(--portal-text)]'
                  )}
                >
                  {m.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  )}
                  <p className="mt-1 text-xs text-[var(--portal-text-muted)]">
                    {format(new Date(m.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
