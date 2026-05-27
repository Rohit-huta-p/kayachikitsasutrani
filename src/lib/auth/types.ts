export interface PublicUser {
  id: string;
  email: string;
  role: 'student' | 'admin';
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  universityName?: string;
  course?: string;
  createdAt: string;
}

export interface SignupBody {
  email: string;
  password: string;
  name: string;
  age?: number;
  gender?: 'male' | 'female' | 'other';
  universityName?: string;
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
  words: WordTiming[];
  fullTimings: WordTiming[];
}

export interface PublicShloka {
  id: string;
  slug: string;
  title: string;
  meaning: string;
  translation: string;
  status: 'draft' | 'published';
  audio: {
    full: ShlokaAsset;
    lines: ShlokaAsset[];
  };
  image?: ShlokaAsset;
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
  translation: string;
  status?: 'draft' | 'published';
  audio: {
    full: ShlokaAssetInput;
    lines: ShlokaAssetInput[];
  };
  image?: ShlokaAssetInput;
  lines: ShlokaLine[];
}
