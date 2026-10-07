export const DEV_SAMPLE_UID = 'dev-sample';
export const DEV_SAMPLE_MARKER = 'lms_dev_sample';
export const DEV_SAMPLE_PREV = 'lms_dev_sample_prev';

export function devSampleOpen() {
  if (import.meta.env?.DEV !== true || typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(DEV_SAMPLE_MARKER) === '1'
      && localStorage.getItem('lms_active_uid') === DEV_SAMPLE_UID;
  } catch {
    return false;
  }
}
