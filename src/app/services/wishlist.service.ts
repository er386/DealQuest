import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

const API = '/api/wishlist';

export interface WishlistItem {
  gameID: string;
  dealID?: string;
  title?: string;
  thumb?: string;
  storeID?: string;
  salePrice?: string;
  normalPrice?: string;
  targetPrice?: number | null;
  savedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class WishlistService {
  items = signal<WishlistItem[]>([]);
  loaded = signal(false);

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  load(force = false): Observable<WishlistItem[]> {
    return new Observable(observer => {
      if (this.loaded() && !force) {
        observer.next(this.items());
        observer.complete();
        return;
      }
      this.http.get<WishlistItem[]>(API, { headers: this.headers() }).subscribe({
        next: list => {
          this.items.set(list);
          this.loaded.set(true);
          observer.next(list);
          observer.complete();
        },
        error: err => observer.error(err),
      });
    });
  }

  has(gameID: string): boolean {
    return this.items().some(i => i.gameID === gameID);
  }

  add(item: WishlistItem): Observable<WishlistItem> {
    return this.http.post<WishlistItem>(API, item, { headers: this.headers() }).pipe(
      tap(saved => this.items.update(list => [...list, saved]))
    );
  }

  remove(gameID: string): Observable<void> {
    return this.http.delete<void>(`${API}/${gameID}`, { headers: this.headers() }).pipe(
      tap(() => this.items.update(list => list.filter(i => i.gameID !== gameID)))
    );
  }

  setTarget(gameID: string, targetPrice: number | null): Observable<WishlistItem> {
    return this.http.patch<WishlistItem>(`${API}/${gameID}`, { targetPrice }, { headers: this.headers() }).pipe(
      tap(updated => this.items.update(list =>
        list.map(i => i.gameID === gameID ? { ...i, ...updated } : i)
      ))
    );
  }

  clear() {
    this.items.set([]);
    this.loaded.set(false);
  }
}
