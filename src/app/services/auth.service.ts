import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';
import { WishlistService } from './wishlist.service';

const API = '/api/auth';

type SessionResponse = { token: string; username: string; role: string };
type MfaChallenge = { mfaRequired: true; mfaToken: string };
export type LoginResult =
  | { kind: 'session' }
  | { kind: 'mfa'; mfaToken: string };

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  username = signal<string | null>(localStorage.getItem('username'));
  role = signal<string | null>(localStorage.getItem('role'));
  isLoggedIn = computed(() => this.username() !== null);
  isAdmin = computed(() => this.role() === 'admin');

  constructor(private http: HttpClient, private wishlist: WishlistService) {}

  private authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  register(username: string, email: string, password: string) {
    return this.http.post<SessionResponse>(`${API}/register`, { username, email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  login(email: string, password: string): Observable<LoginResult> {
    return this.http.post<SessionResponse | MfaChallenge>(`${API}/login`, { email, password }).pipe(
      map(res => {
        if ('mfaRequired' in res) {
          return { kind: 'mfa', mfaToken: res.mfaToken } as const;
        }
        this.saveSession(res);
        return { kind: 'session' } as const;
      })
    );
  }

  verifyMfaLogin(mfaToken: string, code: string): Observable<void> {
    return this.http.post<SessionResponse>(`${API}/login/mfa`, { mfaToken, code }).pipe(
      tap(res => this.saveSession(res)),
      map(() => void 0)
    );
  }

  mfaStatus(): Observable<{ mfaEnabled: boolean }> {
    return this.http.get<{ mfaEnabled: boolean }>(`${API}/mfa/status`, { headers: this.authHeaders() });
  }

  mfaSetup(): Observable<MfaSetupResponse> {
    return this.http.post<MfaSetupResponse>(`${API}/mfa/setup`, {}, { headers: this.authHeaders() });
  }

  mfaEnable(code: string): Observable<{ mfaEnabled: boolean }> {
    return this.http.post<{ mfaEnabled: boolean }>(`${API}/mfa/enable`, { code }, { headers: this.authHeaders() });
  }

  mfaDisable(code: string): Observable<{ mfaEnabled: boolean }> {
    return this.http.post<{ mfaEnabled: boolean }>(`${API}/mfa/disable`, { code }, { headers: this.authHeaders() });
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    this.username.set(null);
    this.role.set(null);
    this.wishlist.clear();
  }

  getUsername(): string | null {
    return this.username();
  }

  private saveSession(res: SessionResponse) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('username', res.username);
    localStorage.setItem('role', res.role);
    this.username.set(res.username);
    this.role.set(res.role);
  }
}
