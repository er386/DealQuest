import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';

@Component({
  selector: 'app-deals',
  imports: [RouterLink, Navbar],
  templateUrl: './deals.html',
  styleUrl: './deals.css',
})
export class Deals {
  activeFilter = 'All';
  filters = ['All', 'Under $5', 'Under $15', 'Free'];

  setFilter(f: string) { this.activeFilter = f; }

  toggleWishlist(event: Event) {
    const btn = (event.currentTarget as HTMLElement);
    btn.classList.toggle('saved');
  }
}
