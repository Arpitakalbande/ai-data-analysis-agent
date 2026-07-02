const API_BASE_URL = (import.meta.env.VITE_API_URL || import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : 'https://data-analytics-agent-7w17.onrender.com')).replace(/\/$/, '');

interface SignUpRequest {
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface AuthResponse {
  user_id: string;
  email: string;
  access_token: string;
  token_type: string;
}

export const authService = {
  async signUp(request: SignUpRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Sign up failed');
    }

    return response.json();
  },

  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    return response.json();
  },

  getStoredToken(): string | null {
    return localStorage.getItem('jwt_access_token');
  },

  saveToken(token: string): void {
    localStorage.setItem('jwt_access_token', token);
  },

  removeToken(): void {
    localStorage.removeItem('jwt_access_token');
  },

  getAuthHeader(): Record<string, string> {
    const token = this.getStoredToken();
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
      };
    }
    return {};
  },
};
