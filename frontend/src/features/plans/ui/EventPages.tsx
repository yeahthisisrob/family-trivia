/**
 * An event's page, the editor and quick add, opened from anywhere that
 * lists plans (Home's What's on, the Events tab): one place holds which is open.
 */
import type { Drop } from '@family-trivia/shared';
import { type ReactNode, useState } from 'react';
import { EventDialog } from './EventDialog';
import { EventEditor } from './EventEditor';
import { QuickAdd } from './QuickAdd';

export function useEventPages(me: string, nameOf: (id: string) => string) {
  const [opened, setOpened] = useState<{ id: string; day: string } | null>(null);
  const [form, setForm] = useState<{ date: string; editing?: Drop } | null>(null);
  const [quick, setQuick] = useState(false);
  const pages: ReactNode = (
    <>
      <EventDialog
        id={opened?.id ?? null}
        day={opened?.day}
        me={me}
        nameOf={nameOf}
        onClose={() => setOpened(null)}
        onEdit={(editing) => {
          setOpened(null);
          setForm({ date: editing.start, editing });
        }}
      />
      <EventEditor
        open={!!form}
        me={me}
        date={form?.date ?? ''}
        editing={form?.editing}
        onClose={() => setForm(null)}
      />
      <QuickAdd
        open={quick}
        onClose={() => setQuick(false)}
        onDetails={(drop) => {
          setQuick(false);
          setForm({ date: drop.start, editing: drop });
        }}
      />
    </>
  );
  return {
    open: (id: string, day: string) => setOpened({ id, day }),
    create: (date: string) => setForm({ date }),
    quickAdd: () => setQuick(true),
    pages,
  };
}
