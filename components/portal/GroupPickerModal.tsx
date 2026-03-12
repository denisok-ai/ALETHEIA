'use client';

/**
 * Modal to pick one group by moduleType (for bulk "add to group").
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface GroupOption {
  id: string;
  name: string;
  parentId: string | null;
}

export interface GroupPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  moduleType: 'course' | 'media' | 'user';
  onSelect: (groupId: string) => void;
  title?: string;
  confirmLabel?: string;
}

export function GroupPickerModal({
  open,
  onOpenChange,
  moduleType,
  onSelect,
  title = 'Добавить в группу',
  confirmLabel = 'Добавить',
}: GroupPickerModalProps) {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    if (open) {
      setSelectedId('');
      setLoading(true);
      fetch(`/api/portal/admin/groups?moduleType=${moduleType}`)
        .then((r) => (r.ok ? r.json() : { groups: [] }))
        .then((d) => setGroups(d.groups ?? []))
        .finally(() => setLoading(false));
    }
  }, [open, moduleType]);

  function handleConfirm() {
    if (!selectedId) return;
    onSelect(selectedId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          {loading ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Загрузка списка групп…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-[var(--portal-text-muted)]">Нет доступных групп. Создайте группу в сайдбаре.</p>
          ) : (
            <>
              <label className="text-sm font-medium text-[var(--portal-text)]">Выберите группу</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="mt-2 w-full rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[var(--portal-text)] focus:ring-2 focus:ring-[#6366F1]"
              >
                <option value="">—</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleConfirm} disabled={!selectedId}>
                  {confirmLabel}
                </Button>
                <Button variant="ghost" onClick={() => onOpenChange(false)}>
                  Отмена
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
