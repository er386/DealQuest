import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

const API = '/api/comments';

export interface Comment {
  _id: string;
  gameID: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CommentsService {
  items = signal<Comment[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private http: HttpClient) {}

  private headers(): HttpHeaders {
    const token = localStorage.getItem('token');
    return new HttpHeaders(token ? { Authorization: `Bearer ${token}` } : {});
  }

  load(gameID: string): Observable<Comment[]> {
    this.loading.set(true);
    this.error.set(null);
    const params = new HttpParams().set('gameID', gameID);
    return new Observable(observer => {
      this.http.get<Comment[]>(API, { params }).subscribe({
        next: list => {
          this.items.set(list);
          this.loading.set(false);
          observer.next(list);
          observer.complete();
        },
        error: err => {
          this.error.set('Failed to load comments');
          this.loading.set(false);
          observer.error(err);
        },
      });
    });
  }

  post(gameID: string, body: string): Observable<Comment> {
    return this.http.post<Comment>(API, { gameID, body }, { headers: this.headers() }).pipe(
      tap(c => this.items.update(list => [c, ...list]))
    );
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/${id}`, { headers: this.headers() }).pipe(
      tap(() => this.items.update(list => list.filter(c => c._id !== id)))
    );
  }

  clear() {
    this.items.set([]);
  }
}
