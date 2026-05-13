import { Component, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-chat-widget',
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.css',
})
export class ChatWidget implements AfterViewChecked {
  @ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;

  open = signal(false);
  pending = signal(false);
  error = signal('');
  draft = '';
  private shouldScroll = false;

  constructor(public chat: ChatService) {}

  get messages() {
    return this.chat.messages;
  }

  ngAfterViewChecked() {
    if (this.shouldScroll && this.threadRef) {
      const el = this.threadRef.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  toggle() {
    this.open.update(v => !v);
    if (this.open()) this.shouldScroll = true;
  }

  close() {
    this.open.set(false);
  }

  send() {
    const text = this.draft.trim();
    if (!text || this.pending()) return;

    this.chat.append({ role: 'user', content: text });
    this.draft = '';
    this.pending.set(true);
    this.error.set('');
    this.shouldScroll = true;

    this.chat.send(this.messages()).subscribe({
      next: r => {
        this.chat.append({ role: 'assistant', content: r.reply });
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
    this.chat.reset();
    this.error.set('');
  }

  suggest(text: string) {
    this.draft = text;
  }
}
