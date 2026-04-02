import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';

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
  loading = false;

  togglePw() { this.showPassword = !this.showPassword; }

  handleLogin() {
    this.emailError = !this.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
    this.passwordError = !this.password;
    if (!this.emailError && !this.passwordError) {
      this.loading = true;
    }
  }
}
