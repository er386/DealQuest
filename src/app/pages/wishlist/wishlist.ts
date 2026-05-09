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
  livePrices = signal<Record<string, number>>({});
  loading = signal(false);
  error = signal('');

  editingTarget = signal<string | null>(null);
  targetInput = signal<string>('');
  savingTarget = signal(false);

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
      next: list => {
        this.items.set(list);
        this.loading.set(false);
        this.refreshLivePrices(list);
      },
      error: () => { this.error.set('Failed to load wishlist.'); this.loading.set(false); }
    });
  }

  private refreshLivePrices(list: WishlistItem[]) {
    for (const item of list) {
      this.cheapshark.getGame(item.gameID).subscribe({
        next: res => {
          const cheapest = res?.deals?.[0]?.price;
          const price = parseFloat(cheapest);
          if (!isNaN(price)) {
            this.livePrices.update(m => ({ ...m, [item.gameID]: price }));
          }
        },
        error: () => {},
      });
    }
  }

  totalGames = computed(() => this.items().length);
  totalSavings = computed(() => {
    return this.items().reduce((sum, i) => {
      const sale = this.effectivePrice(i);
      const normal = parseFloat(i.normalPrice || '0');
      return sum + Math.max(0, normal - sale);
    }, 0);
  });
  targetsHit = computed(() => this.items().filter(i => this.isTargetHit(i)).length);

  storeName(id?: string): string {
    if (!id) return '';
    return this.storeMap()[id] || `Store ${id}`;
  }

  effectivePrice(item: WishlistItem): number {
    const live = this.livePrices()[item.gameID];
    if (live !== undefined) return live;
    return parseFloat(item.salePrice || '0');
  }

  hasLivePrice(item: WishlistItem): boolean {
    return this.livePrices()[item.gameID] !== undefined;
  }

  livePriceChanged(item: WishlistItem): boolean {
    const live = this.livePrices()[item.gameID];
    if (live === undefined) return false;
    const stored = parseFloat(item.salePrice || '0');
    return Math.abs(live - stored) >= 0.01;
  }

  savings(item: WishlistItem): number {
    const sale = this.effectivePrice(item);
    const normal = parseFloat(item.normalPrice || '0');
    if (normal <= 0) return 0;
    return Math.round(((normal - sale) / normal) * 100);
  }

  isTargetHit(item: WishlistItem): boolean {
    if (item.targetPrice == null) return false;
    return this.effectivePrice(item) <= item.targetPrice;
  }

  priceGap(item: WishlistItem): number {
    if (item.targetPrice == null) return 0;
    return Math.max(0, this.effectivePrice(item) - item.targetPrice);
  }

  startEditTarget(item: WishlistItem) {
    this.editingTarget.set(item.gameID);
    this.targetInput.set(item.targetPrice != null ? String(item.targetPrice) : '');
  }

  cancelEdit() {
    this.editingTarget.set(null);
    this.targetInput.set('');
  }

  saveTarget(item: WishlistItem) {
    const raw = this.targetInput().trim();
    let value: number | null;
    if (raw === '') {
      value = null;
    } else {
      const parsed = parseFloat(raw);
      if (isNaN(parsed) || parsed < 0) return;
      value = Math.round(parsed * 100) / 100;
    }
    this.savingTarget.set(true);
    this.wishlist.setTarget(item.gameID, value).subscribe({
      next: () => {
        this.savingTarget.set(false);
        this.editingTarget.set(null);
        this.targetInput.set('');
        this.items.set(this.wishlist.items());
      },
      error: () => { this.savingTarget.set(false); },
    });
  }

  clearTarget(item: WishlistItem) {
    this.wishlist.setTarget(item.gameID, null).subscribe({
      next: () => this.items.set(this.wishlist.items()),
    });
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
