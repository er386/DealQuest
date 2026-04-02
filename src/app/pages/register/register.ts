import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';

@Component({
  selector: 'app-register',
  imports: [RouterLink, FormsModule, Navbar],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {
  username = '';
  email = '';
  password = '';
  confirm = '';
  terms = false;
  showPassword = false;
  showConfirm = false;
  loading = false;

  errors: Record<string, boolean> = {};
  pwStrength = 0;
  pwLabel = 'Use 8+ characters with numbers and symbols';

  togglePw(field: 'password' | 'confirm') {
    if (field === 'password') this.showPassword = !this.showPassword;
    else this.showConfirm = !this.showConfirm;
  }

  checkStrength() {
    const v = this.password;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    this.pwStrength = score;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    const hints = ['uppercase letters', 'numbers', 'symbols'];
    this.pwLabel = v.length === 0 ? 'Use 8+ characters with numbers and symbols'
      : score < 4 ? labels[score] + ' — add ' + (hints[score - 1] || 'more variety')
      : 'Strong password!';
  }

  getBarClass(i: number): string {
    if (i >= this.pwStrength) return '';
    const cls = ['', 'weak', 'fair', 'good', 'strong'];
    return cls[this.pwStrength];
  }

  handleRegister() {
    this.errors = {};
    if (this.username.length < 3) this.errors['username'] = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) this.errors['email'] = true;
    if (this.password.length < 8) this.errors['password'] = true;
    if (this.confirm !== this.password) this.errors['confirm'] = true;
    if (!this.terms) this.errors['terms'] = true;
    if (Object.keys(this.errors).length === 0) {
      this.loading = true;
    }
  }
}
