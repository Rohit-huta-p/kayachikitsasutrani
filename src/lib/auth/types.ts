export interface PublicUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  collegeName?: string;
  course?: string;
  status?: 'pending' | 'active';
  createdAt: string;
}

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  collegeName?: string;
  course?: string;
  createdAt: string;
}

export interface AcceptedAccessRequest {
  id: string;
  name: string;
  email: string;
  password: string;
  mailtoSubject: string;
  mailtoBody: string;
  mailto: string;
  gmailUrl: string;
  loginUrl: string;
}

export interface SignupBody {
  email: string;
  password: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  collegeName?: string;
  course?: string;
}

/** Access-request body — like SignupBody but with no password field. */
export interface RequestSignupBody {
  email: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  collegeName?: string;
  course?: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface ApiError extends Error {
  code: string;
  status: number;
}

// ── Shloka types (mirror backend PublicShloka) ────────────────────────────

export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export interface ShlokaAsset {
  url: string;
  publicId?: string; // admin responses only
}

export interface ShlokaLine {
  sanskrit: string;
  words?: WordTiming[];
  fullTimings: WordTiming[];
}

export interface PublicShloka {
  id: string;
  slug: string;
  title: string;
  meaning: string;
  fullText?: string;
  highlightWords?: string[];
  caseStudy?: string;
  reference?: string;
  status: 'draft' | 'published';
  audio: {
    full: ShlokaAsset;
    lines: ShlokaAsset[];
  };
  meaningAudio?: ShlokaAsset;
  meaningTimings?: WordTiming[];
  image?: ShlokaAsset;
  images: ShlokaAsset[];
  lines: ShlokaLine[];
  createdAt: string;
  updatedAt: string;
}

// Request body for create/update (publicId is required since we just uploaded it)
export interface ShlokaAssetInput {
  url: string;
  publicId: string;
}

export interface ShlokaInput {
  slug: string;
  title: string;
  meaning: string;
  fullText?: string;
  highlightWords?: string[];
  caseStudy?: string;
  reference?: string;
  status?: 'draft' | 'published';
  audio: {
    full: ShlokaAssetInput;
    lines: ShlokaAssetInput[];
  };
  /** null clears the meaning audio on PATCH; omit to leave unchanged. */
  meaningAudio?: ShlokaAssetInput | null;
  meaningTimings?: WordTiming[];
  image?: ShlokaAssetInput;
  images?: ShlokaAssetInput[];
  lines: ShlokaLine[];
}

// ── Completion + Leaderboard ──────────────────────────────────────────────

export interface CompletionRecord {
  id: string;
  userId: string;
  shlokaId: string;
  completedAt: string;
  attempts: number;
  elapsedSeconds: number;
}

export interface CompleteResponse {
  completion: CompletionRecord;
  alreadyCompleted: boolean;
}

export interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  initials: string;
  completedAt: string;
  attempts: number;
  elapsedSeconds: number;
  chronoRank: number;
  timeRank: number;
  attemptsRank: number;
  averageRank: number;
}

export interface LeaderboardResponse {
  total: number;
  items: LeaderboardRow[];
}

// ── My Completions ────────────────────────────────────────────────────────

export interface MyCompletionRow {
  shlokaId: string;
  slug: string;
  title: string;
  completedAt: string;
  attempts: number;
  elapsedSeconds: number;
  rank: number;
  totalCompletions: number;
}

export interface MyCompletionsResponse {
  total: number;
  items: MyCompletionRow[];
}
