import React from 'react';

// 12-hour picker so users can set a bedtime unambiguously (no "pm" typing into
// a 24-hour field). value/onChange use the "HH:MM" 24-hour string the rest of
// the app expects.
const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1)); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')); // 00..55 in 5-min steps

function from24(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour: String(hour12), minute: String(m).padStart(2, '0'), period };
}

function to24(hour, minute, period) {
  let h = parseInt(hour, 10);
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

const selectClass =
  'option-surface rounded-xl border px-3 py-3 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-ring appearance-none';

export default function SleepTimePicker({ value, onChange, requireChoice = false }) {
  const parsed = from24(value);
  const hour = parsed?.hour || '10';
  const minute = parsed?.minute || '30';
  const period = parsed?.period || 'PM';
  const blank = requireChoice && !parsed;
  const update = (patch) => onChange(to24(patch.hour || hour, patch.minute || minute, patch.period || period));
  React.useEffect(() => {
    if (requireChoice || value) return;
    onChange?.(to24(hour, minute, period));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex items-center justify-center gap-2 w-full mb-4">
      <select
        aria-label="Hour"
        value={blank ? '' : hour}
        onChange={(e) => update({ hour: e.target.value })}
        className={selectClass}
      >
        {blank && <option value="">Hour</option>}
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span className="text-lg font-semibold">:</span>
      <select
        aria-label="Minute"
        value={blank ? '' : minute}
        onChange={(e) => update({ minute: e.target.value })}
        className={selectClass}
      >
        {blank && <option value="">Min</option>}
        {MINUTES.map((m) => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        value={blank ? '' : period}
        onChange={(e) => update({ period: e.target.value })}
        className={selectClass}
      >
        {blank && <option value="">—</option>}
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}