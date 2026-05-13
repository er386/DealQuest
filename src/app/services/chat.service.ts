import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API = '/api/chat';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private http: HttpClient) {}

  send(messages: ChatMessage[]): Observable<{ reply: string }> {
    return this.http.post<{ reply: string }>(API, { messages });
  }
}
