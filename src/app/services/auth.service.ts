import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { WishlistService } from './wishlist.service';

const API = '/api/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  username = signal<string | null>(localStorage.getItem('username'));
  isLoggedIn = computed(() => this.username() !== null);

  constructor(private http: HttpClient, private wishlist: WishlistService) {}

  register(username: string, email: string, password: string) {
    return this.http.post<{ token: string; username: string }>(`${API}/register`, { username, email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  login(email: string, password: string) {
    return this.http.post<{ token: string; username: string }>(`${API}/login`, { email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    this.username.set(null);
    this.wishlist.clear();
  }

  getUsername(): string | null {
    return this.username();
  }

  private saveSession(res: { token: string; username: string }) {
    localStorage.setItem('token', res.token);
    localStorage.setItem('username', res.username);
    this.username.set(res.username);
  }
}
