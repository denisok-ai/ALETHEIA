'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { CreateNotificationSetDialog } from './CreateNotificationSetDialog';

export function CreateNotificationSetButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} className="gap-1">
        <Plus className="h-4 w-4" />
        Создать набор
      </Button>
      <CreateNotificationSetDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
