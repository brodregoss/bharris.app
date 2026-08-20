import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionData } from '../core/types';

const KEY = 'lms_session_v1';
const FINISHED_KEY = 'lms_finished_v1';
const ONBOARDING_KEY = 'lms_onboarded';
const BOOTSTRAP_KEY = 'lms_study_bootstrap_v1';

export type StudyBootstrap = {
  terms: SessionData['terms'];
  setup?: SessionData['setup'];
  initialPhase?: string;
  resetState?: boolean;
};

export async function saveStudyBootstrap(data: StudyBootstrap) {
  await AsyncStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(data));
}

export async function consumeStudyBootstrap(): Promise<StudyBootstrap | null> {
  try {
    const raw = await AsyncStorage.getItem(BOOTSTRAP_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(BOOTSTRAP_KEY);
    return JSON.parse(raw) as StudyBootstrap;
  } catch {
    return null;
  }
}

export async function loadSession(): Promise<SessionData | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (!data?.terms?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveSession(data: SessionData) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

export async function clearSession() {
  await AsyncStorage.removeItem(KEY);
}

export async function loadFinishedSession(): Promise<SessionData | null> {
  try {
    const raw = await AsyncStorage.getItem(FINISHED_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionData;
    if (!data?.terms?.length) return null;
    return data;
  } catch {
    return null;
  }
}

export async function saveFinishedSession(data: SessionData) {
  await AsyncStorage.setItem(FINISHED_KEY, JSON.stringify(data));
}

export async function isOnboarded(): Promise<boolean> {
  const v = await AsyncStorage.getItem(ONBOARDING_KEY);
  return v === '1';
}

export async function setOnboarded() {
  await AsyncStorage.setItem(ONBOARDING_KEY, '1');
}

const FLOW_SETUP_KEY = 'lms_flow_setup_v1';

export async function saveFlowSetup(setup: SessionData['setup']) {
  await AsyncStorage.setItem(FLOW_SETUP_KEY, JSON.stringify(setup));
}

export async function loadFlowSetup(): Promise<SessionData['setup'] | null> {
  try {
    const raw = await AsyncStorage.getItem(FLOW_SETUP_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const FLOW_SOURCE_KEY = 'lms_flow_source_v1';

export async function saveFlowSource(source: unknown) {
  await AsyncStorage.setItem(FLOW_SOURCE_KEY, JSON.stringify(source));
}

export async function loadFlowSource<T>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(FLOW_SOURCE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const PANIC_KEY = 'lms_panic_v1';

export async function loadPanicSummary(): Promise<{ signature: string; text: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(PANIC_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function savePanicSummary(signature: string, text: string) {
  await AsyncStorage.setItem(PANIC_KEY, JSON.stringify({ signature, text }));
}

export function panicSignature(terms: SessionData['terms']) {
  return terms
    .map((t) => `${t.id}:${t.confidence}:${t.correctStreak}:${t.testResult}`)
    .join('|');
}
