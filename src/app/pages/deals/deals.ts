import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { Navbar } from '../../components/navbar/navbar';
import { CheapSharkService, Deal, DealQuery } from '../../services/cheapshark.service';

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

  deals: Deal[] = [];
  storeMap: Record<string, string> = {};
  loading = false;
  error = '';

  private search$ = new Subject<void>();

  constructor(private cheapshark: CheapSharkService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.cheapshark.getStoreMap().subscribe(m => this.storeMap = m);

    this.search$
      .pipe(
        debounceTime(350),
        switchMap(() => {
          this.loading = true;
          this.error = '';
          return this.cheapshark.getDeals(this.buildQuery());
        })
      )
      .subscribe({
        next: deals => { this.deals = deals; this.loading = false; },
        error: () => { this.error = 'Could not load deals. Try again.'; this.loading = false; }
      });

    this.route.queryParamMap.subscribe(params => {
      const q = params.get('q') ?? '';
      if (q !== this.searchTerm) {
        this.searchTerm = q;
      }
      this.runSearch();
    });
  }

  runSearch() { this.search$.next(); }

  setFilter(f: PriceFilter) { this.activeFilter = f; this.runSearch(); }

  storeName(id: string): string { return this.storeMap[id] || `Store ${id}`; }

  dealUrl(dealID: string): string {
    return `https://www.cheapshark.com/redirect?dealID=${dealID}`;
  }

  toggleWishlist(event: Event) {
    event.stopPropagation();
    const btn = (event.currentTarget as HTMLElement);
    btn.classList.toggle('saved');
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
