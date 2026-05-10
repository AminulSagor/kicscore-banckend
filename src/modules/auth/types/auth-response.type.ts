import { UserRole } from '../../users/enums/user-role.enum';

export interface AuthUserResponse {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface AuthTokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

export interface AuthResponse {
  user: AuthUserResponse;
  token: AuthTokenResponse;
}
