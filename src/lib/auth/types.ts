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
