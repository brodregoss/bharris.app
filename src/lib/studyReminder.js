import { Capacitor } from '@capacitor/core';
import { reminderMode, WAIT_WHY, WEB_REMINDER_NOTE } from '@/lib/spacedCram';

const REMINDER_ID = 4101;

export { WEB_REMINDER_NOTE };

export function currentReminderMode() {
  return reminderMode({
    native: Capacitor.isNativePlatform(),
    canNotify: typeof Notification !== 'undefined',
  });
}

export async function scheduleStudyReminder(dueAt) {
  const mode = currentReminderMode();
  const due = Number(dueAt);
  if (mode === 'off' || !Number.isFinite(due) || due <= Date.now()) return { ok: false, mode };
  if (mode === 'native') {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const perm = await LocalNotifications.requestPermissions();
      if (perm?.display !== 'granted') return { ok: false, mode };
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] });
      await LocalNotifications.schedule({
        notifications: [{
          id: REMINDER_ID,
          title: 'Time for your next sitting',
          body: WAIT_WHY,
          schedule: { at: new Date(due) },
        }],
      });
      return { ok: true, mode };
    } catch {
      return { ok: false, mode };
    }
  }
  try {
    let perm = Notification.permission;
    if (perm === 'default' && Notification.requestPermission) {
      perm = await Notification.requestPermission();
    }
    if (perm !== 'granted') return { ok: false, mode };
    const wait = due - Date.now();
    window.setTimeout(() => {
      try {
        new Notification('Time for your next sitting', { body: WAIT_WHY });
      } catch {
        // The tab was closed. The button already said this only works while it is open.
      }
    }, wait);
    return { ok: true, mode };
  } catch {
    return { ok: false, mode };
  }
}
