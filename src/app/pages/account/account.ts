import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../../components/navbar/navbar';
import { AuthService, MfaSetupResponse } from '../../services/auth.service';

type Mode = 'idle' | 'enrolling' | 'disabling';

@Component({
  selector: 'app-account',
  imports: [CommonModule, FormsModule, Navbar],
  templateUrl: './account.html',
  styleUrl: './account.css',
})
export class Account implements OnInit {
  mfaEnabled = signal<boolean | null>(null);
  loading = signal(false);
  error = signal('');

  mode = signal<Mode>('idle');
  setup = signal<MfaSetupResponse | null>(null);
  code = '';
  submitting = signal(false);
  showSecret = signal(false);

  constructor(public auth: AuthService, private router: Router) {}

  ngOnInit() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.refreshStatus();
  }

  private refreshStatus() {
    this.loading.set(true);
    this.auth.mfaStatus().subscribe({
      next: res => {
        this.mfaEnabled.set(res.mfaEnabled);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load MFA status.');
        this.loading.set(false);
      },
    });
  }

  beginEnroll() {
    this.error.set('');
    this.code = '';
    this.submitting.set(true);
    this.auth.mfaSetup().subscribe({
      next: res => {
        this.setup.set(res);
        this.mode.set('enrolling');
        this.submitting.set(false);
      },
      error: err => {
        this.error.set(err.error?.message || 'Failed to start enrollment.');
        this.submitting.set(false);
      },
    });
  }

  confirmEnroll() {
    if (!/^\d{6}$/.test(this.code.trim())) {
      this.error.set('Enter the 6-digit code from your authenticator app.');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    this.auth.mfaEnable(this.code.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.mode.set('idle');
        this.setup.set(null);
        this.code = '';
        this.mfaEnabled.set(true);
      },
      error: err => {
        this.error.set(err.error?.message || 'Invalid code.');
        this.submitting.set(false);
      },
    });
  }

  cancelEnroll() {
    this.mode.set('idle');
    this.setup.set(null);
    this.code = '';
    this.error.set('');
    this.refreshStatus();
  }

  beginDisable() {
    this.error.set('');
    this.code = '';
    this.mode.set('disabling');
  }

  confirmDisable() {
    if (!/^\d{6}$/.test(this.code.trim())) {
      this.error.set('Enter the 6-digit code from your authenticator app.');
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    this.auth.mfaDisable(this.code.trim()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.mode.set('idle');
        this.code = '';
        this.mfaEnabled.set(false);
      },
      error: err => {
        this.error.set(err.error?.message || 'Invalid code.');
        this.submitting.set(false);
      },
    });
  }

  cancelDisable() {
    this.mode.set('idle');
    this.code = '';
    this.error.set('');
  }

  toggleSecret() {
    this.showSecret.update(v => !v);
  }
}
