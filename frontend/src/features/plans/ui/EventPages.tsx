/**
 * An event's page and the event form, opened from anywhere that lists plans
 * (Home's What's on, the Events tab): one place holds which is open.
 */
import type { Drop } from '@family-trivia/shared';
import { type ReactNode, useState } from 'react';
import { EventDialog } from './EventDialog';
import { EventForm } from './EventForm';

export function useEventPages(me: string, nameOf: (id: string) => string) {
  const [opened, setOpened] = useState<{ id: string; day: string } | null>(null);
  const [form, setForm] = useState<{ date: string; editing?: Drop } | null>(null);
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
      <EventForm
        open={!!form}
        me={me}
        date={form?.date ?? ''}
        editing={form?.editing}
        onClose={() => setForm(null)}
      />
    </>
  );
  return {
    open: (id: string, day: string) => setOpened({ id, day }),
    create: (date: string) => setForm({ date }),
    pages,
  };
}
