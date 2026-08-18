export type ExamType = 'multiple_choice' | 'short_answer' | 'mixed' | '';
export type ExamTiming = 'today' | 'tomorrow' | 'later' | '';

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
  recallHistory?: { result: 'got_it' | 'missed' }[];
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
  blockStats?: Record<string, unknown>;
  stillShaky?: string[];
  sessionStart?: number;
};
