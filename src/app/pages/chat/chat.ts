import { Component, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { ChatService, ChatMessage } from '../../services/chat.service';

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule, RouterLink, Navbar],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements AfterViewChecked {
  @ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;

  messages = signal<ChatMessage[]>([]);
  pending = signal(false);
  error = signal('');
  draft = '';
  private shouldScroll = false;

  constructor(private chat: ChatService) {}

  ngAfterViewChecked() {
    if (this.shouldScroll && this.threadRef) {
      const el = this.threadRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  send() {
    const text = this.draft.trim();
    if (!text || this.pending()) return;

    const next: ChatMessage[] = [...this.messages(), { role: 'user', content: text }];
    this.messages.set(next);
    this.draft = '';
    this.pending.set(true);
    this.error.set('');
    this.shouldScroll = true;

    this.chat.send(next).subscribe({
      next: r => {
        this.messages.update(list => [...list, { role: 'assistant', content: r.reply }]);
        this.pending.set(false);
        this.shouldScroll = true;
      },
      error: err => {
        this.error.set(err?.error?.message || 'Chatbot is unavailable right now.');
        this.pending.set(false);
      },
    });
  }

  reset() {
    this.messages.set([]);
    this.error.set('');
  }

  suggest(text: string) {
    this.draft = text;
  }
}
