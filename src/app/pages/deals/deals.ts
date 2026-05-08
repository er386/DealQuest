import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { Navbar } from '../../components/navbar/navbar';
import { CheapSharkService, Deal, DealQuery } from '../../services/cheapshark.service';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';

type PriceFilter = 'All' | 'Under $5' | 'Under $15' | 'Free';
type SortLabel = 'Best Deal' | 'Lowest Price' | 'Highest Discount' | 'Recent' | 'Metacritic Score';

@Component({
  selector: 'app-deals',
  imports: [FormsModule, CommonModule, Navbar],
  templateUrl: './deals.html',
  styleUrl: './deals.css',
})
export class Deals implements OnInit {
  searchTerm = '';
  activeFilter: PriceFilter = 'All';
  filters: PriceFilter[] = ['All', 'Under $5', 'Under $15', 'Free'];
  sortLabel: SortLabel = 'Best Deal';
  storeFilter = '';

  deals = signal<Deal[]>([]);
  storeMap = signal<Record<string, string>>({});
  loading = signal(false);
  error = signal('');

  private search$ = new Subject<void>();

  constructor(
    private cheapshark: CheapSharkService,
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    public wishlist: WishlistService,
  ) {}

  ngOnInit() {
    this.cheapshark.getStoreMap().subscribe(m => this.storeMap.set(m));
    if (this.auth.isLoggedIn()) {
      this.wishlist.load().subscribe({ error: () => {} });
    }

    this.search$
      .pipe(
        debounceTime(350),
        switchMap(() => {
          this.loading.set(true);
          this.error.set('');
          return this.cheapshark.getDeals(this.buildQuery());
        })
      )
      .subscribe({
        next: (deals: Deal[]) => { this.deals.set(deals); this.loading.set(false); },
        error: () => { this.error.set('Could not load deals. Try again.'); this.loading.set(false); }
      });

    this.searchTerm = this.route.snapshot.queryParamMap.get('q') ?? '';
    this.fetchNow();

    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q') ?? '';
      if (q !== this.searchTerm) {
        this.searchTerm = q;
        this.fetchNow();
      }
    });
  }

  runSearch() { this.search$.next(); }
  runSearchNow() { this.fetchNow(); }

  setFilter(f: PriceFilter) { this.activeFilter = f; this.fetchNow(); }

  storeName(id: string): string { return this.storeMap()[id] || `Store ${id}`; }

  dealUrl(dealID: string): string {
    return `https://www.cheapshark.com/redirect?dealID=${dealID}`;
  }

  isSaved(gameID: string): boolean {
    return this.wishlist.has(gameID);
  }

  toggleWishlist(deal: Deal, event: Event) {
    event.stopPropagation();
    event.preventDefault();
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.wishlist.has(deal.gameID)) {
      this.wishlist.remove(deal.gameID).subscribe();
    } else {
      this.wishlist.add({
        gameID: deal.gameID,
        dealID: deal.dealID,
        title: deal.title,
        thumb: deal.thumb,
        storeID: deal.storeID,
        salePrice: deal.salePrice,
        normalPrice: deal.normalPrice,
      }).subscribe();
    }
  }

  private fetchNow() {
    this.loading.set(true);
    this.error.set('');
    this.cheapshark.getDeals(this.buildQuery()).subscribe({
      next: (deals: Deal[]) => { this.deals.set(deals); this.loading.set(false); },
      error: () => { this.error.set('Could not load deals. Try again.'); this.loading.set(false); }
    });
  }

  private buildQuery(): DealQuery {
    const q: DealQuery = {
      pageSize: 24,
      sortBy: this.mapSort(this.sortLabel),
      desc: 1,
    };
    if (this.searchTerm.trim()) q.title = this.searchTerm.trim();
    if (this.storeFilter) q.storeID = this.storeFilter;
    if (this.activeFilter === 'Under $5') q.upperPrice = 5;
    if (this.activeFilter === 'Under $15') q.upperPrice = 15;
    if (this.activeFilter === 'Free') q.upperPrice = 0;
    return q;
  }

  private mapSort(label: SortLabel): DealQuery['sortBy'] {
    switch (label) {
      case 'Lowest Price': return 'Price';
      case 'Highest Discount': return 'Savings';
      case 'Recent': return 'Recent';
      case 'Metacritic Score': return 'Metacritic';
      default: return 'Deal Rating';
    }
  }
}
