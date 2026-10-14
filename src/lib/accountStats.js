import { workerRequest } from '@/lib/workerClient';
import { devAuthHeaders } from '@/lib/devToolsLock';

export function fetchAccountStats() {
  return workerRequest('GET', '/v1/dev-tools/stats', undefined, devAuthHeaders());
}
