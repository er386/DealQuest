import { Component, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  auth = inject(AuthService);
  private router = inject(Router);
  menuOpen = signal(false);

  toggleMenu(event: MouseEvent) {
    event.stopPropagation();
    this.menuOpen.update(v => !v);
  }

  closeMenu() {
    this.menuOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick() {
    if (this.menuOpen()) this.menuOpen.set(false);
  }

  logout() {
    this.auth.logout();
    this.menuOpen.set(false);
    this.router.navigateByUrl('/');
  }
}
