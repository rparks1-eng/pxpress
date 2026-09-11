import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { NotificationSettings } from './NotificationSettings';

describe('notification settings device persistence', () => {
  let failWrites = true;
  const values = new Map<string, string>();
  beforeEach(() => {
    failWrites = true;
    values.clear();
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { if (failWrites) throw new Error('storage blocked'); values.set(key, value); },
      removeItem: (key: string) => values.delete(key), clear: () => values.clear(), key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } satisfies Storage });
  });

  it('never claims saved after a failed write and offers a working retry', () => {
    render(<MemoryRouter><NotificationSettings/></MemoryRouter>);
    const toggle = screen.getByRole('checkbox', { name: /New requests/i });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(screen.getByRole('alert')).toHaveTextContent('could not be saved');
    expect(screen.queryByText('Notification choices saved on this device.')).not.toBeInTheDocument();
    expect(toggle).toBeChecked();
    failWrites = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try saving again' }));
    expect(toggle).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('Draft saved on this device. It is not active on the server until you choose Save settings.');
  });
});
