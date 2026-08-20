export type ExamType = 'multiple_choice' | 'short_answer' | 'mixed' | '';
export type ExamTiming = 'today' | 'tomorrow' | '2days' | '';

export type StudySetup = {
  terms: number;
  hours: number;
  examType: ExamType;
  examTiming: ExamTiming;
};

export type TriageTier = 'blank' | 'shaky' | 'know_it';

export type StudyTier = 'critical' | 'core' | 'passive';
export type Confidence = 'blank' | 'shaky' | 'know';

export type StudyTerm = {
  id: string;
  term: string;
  definition: string;
  difficulty: number;
  tier: StudyTier;
  confidence: Confidence;
  depends_on?: string[];
  recallHistory?: { timestamp?: number; result: 'got_it' | 'missed' }[];
  correctStreak?: number;
  seen?: boolean;
  testResult?: boolean | null;
};

export type NoteSource = {
  kind: 'sample' | 'photo';
  title: string;
  terms?: number;
  id?: string;
};

export type SessionData = {
  terms: StudyTerm[];
  setup?: StudySetup;
  phase?: string;
  blockStats?: Record<string, { got?: number; total?: number }>;
  stillShaky?: string[];
  behind?: boolean;
  stopTime?: string | null;
  windDownAcknowledged?: boolean;
  elapsedMs?: number;
  sessionStart?: number;
  savedAt?: number;
  finishedAt?: number;
};
