import { Component, OnInit, computed, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { CheapSharkService } from '../../services/cheapshark.service';
import { WishlistService, WishlistItem } from '../../services/wishlist.service';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, FormsModule, CommonModule, Navbar],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist implements OnInit {
  items = signal<WishlistItem[]>([]);
  storeMap = signal<Record<string, string>>({});
  loading = signal(false);
  error = signal('');

  constructor(
    public auth: AuthService,
    private wishlist: WishlistService,
    private cheapshark: CheapSharkService,
    private router: Router,
  ) {}

  ngOnInit() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.cheapshark.getStoreMap().subscribe(m => this.storeMap.set(m));
    this.loading.set(true);
    this.wishlist.load(true).subscribe({
      next: list => { this.items.set(list); this.loading.set(false); },
      error: () => { this.error.set('Failed to load wishlist.'); this.loading.set(false); }
    });
  }

  totalGames = computed(() => this.items().length);
  totalSavings = computed(() => {
    return this.items().reduce((sum, i) => {
      const sale = parseFloat(i.salePrice || '0');
      const normal = parseFloat(i.normalPrice || '0');
      return sum + Math.max(0, normal - sale);
    }, 0);
  });

  storeName(id?: string): string {
    if (!id) return '';
    return this.storeMap()[id] || `Store ${id}`;
  }

  savings(item: WishlistItem): number {
    const sale = parseFloat(item.salePrice || '0');
    const normal = parseFloat(item.normalPrice || '0');
    if (normal <= 0) return 0;
    return Math.round(((normal - sale) / normal) * 100);
  }

  remove(item: WishlistItem) {
    this.wishlist.remove(item.gameID).subscribe({
      next: () => this.items.update(list => list.filter(i => i.gameID !== item.gameID)),
    });
  }

  dealUrl(dealID?: string): string {
    return dealID ? `https://www.cheapshark.com/redirect?dealID=${dealID}` : '#';
  }
}
