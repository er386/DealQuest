import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink, FormsModule, Navbar],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';
  showPassword = false;
  emailError = false;
  passwordError = false;
  serverError = '';
  loading = false;

  step = signal<'credentials' | 'mfa'>('credentials');
  mfaToken = '';
  mfaCode = '';
  mfaError = false;

  constructor(private auth: AuthService, private router: Router) {}

  togglePw() { this.showPassword = !this.showPassword; }

  handleLogin() {
    this.serverError = '';
    this.emailError = !this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    this.passwordError = !this.password;
    if (this.emailError || this.passwordError) return;

    this.loading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: (result) => {
        this.loading = false;
        if (result.kind === 'mfa') {
          this.mfaToken = result.mfaToken;
          this.mfaCode = '';
          this.mfaError = false;
          this.step.set('mfa');
        } else {
          this.router.navigate(['/']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.serverError = err.error?.message || 'Something went wrong. Please try again.';
      }
    });
  }

  submitMfa() {
    this.serverError = '';
    const code = this.mfaCode.trim();
    this.mfaError = !/^\d{6}$/.test(code);
    if (this.mfaError) return;

    this.loading = true;
    this.auth.verifyMfaLogin(this.mfaToken, code).subscribe({
      next: () => this.router.navigate(['/']),
      error: (err) => {
        this.loading = false;
        this.mfaError = true;
        this.serverError = err.error?.message || 'Invalid code. Try again.';
      }
    });
  }

  cancelMfa() {
    this.step.set('credentials');
    this.mfaToken = '';
    this.mfaCode = '';
    this.mfaError = false;
    this.serverError = '';
    this.password = '';
  }
}
