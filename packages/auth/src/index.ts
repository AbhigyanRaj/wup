export interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  token: string;
  user: UserPayload;
}
