import { workerRequest } from '@/lib/workerClient';

export function logProductEvent(name, { feature = '', detail = '' } = {}) {
  workerRequest('POST', '/v1/events', { name, feature, detail }).catch(() => {});
}
