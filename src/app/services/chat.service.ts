import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

const API = '/api/chat';
const STORAGE_KEY = 'dq.chat.messages';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  messages = signal<ChatMessage[]>(this.load());

  constructor(private http: HttpClient) {}

  send(messages: ChatMessage[]): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(API, { messages });
  }

  append(msg: ChatMessage) {
    this.messages.update(list => {
      const next = [...list, msg];
      this.persist(next);
      return next;
    });
  }

  reset() {
    this.messages.set([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  private load(): ChatMessage[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(list: ChatMessage[]) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
  }
}
