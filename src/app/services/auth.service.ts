import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { WishlistService } from './wishlist.service';

const API = '/api/auth';

type AuthResponse = { token: string; username: string; role: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  username = signal<string | null>(localStorage.getItem('username'));
  role = signal<string | null>(localStorage.getItem('role'));
  isLoggedIn = computed(() => this.username() !== null);
  isAdmin = computed(() => this.role() === 'admin');

  constructor(private http: HttpClient, private wishlist: WishlistService) {}

  register(username: string, email: string, password: string) {
    return this.http.post<AuthResponse>(`${API}/register`, { username, email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API}/login`, { email, password }).pipe(
      tap(res => this.saveSession(res))
    );
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

  private saveSession(res: AuthResponse) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('username', res.username);
    localStorage.setItem('role', res.role);
    this.username.set(res.username);
    this.role.set(res.role);
  }
}
