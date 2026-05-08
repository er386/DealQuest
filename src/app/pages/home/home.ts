import { Component, AfterViewInit, OnInit, ElementRef, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../../components/navbar/navbar';
import { CheapSharkService, Deal } from '../../services/cheapshark.service';
import { AuthService } from '../../services/auth.service';
import { WishlistService } from '../../services/wishlist.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, CommonModule, Navbar],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, AfterViewInit {
  searchQuery = '';
  featured = signal<Deal[]>([]);
  topPicks = signal<Deal[]>([]);
  storeMap = signal<Record<string, string>>({});

  constructor(
    private el: ElementRef,
    private cheapshark: CheapSharkService,
    private router: Router,
    public auth: AuthService,
    public wishlist: WishlistService,
  ) {}

  ngOnInit() {
    this.cheapshark.getStoreMap().subscribe(m => this.storeMap.set(m));
    this.cheapshark.getDeals({ sortBy: 'Deal Rating', desc: 1, pageSize: 4 })
      .subscribe(d => this.featured.set(d));
    this.cheapshark.getDeals({ sortBy: 'Savings', desc: 1, pageSize: 4, onSale: 1 })
      .subscribe(d => this.topPicks.set(d));
    if (this.auth.isLoggedIn()) {
      this.wishlist.load().subscribe({ error: () => {} });
    }
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

  ngAfterViewInit() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    this.el.nativeElement.querySelectorAll('.fade-in').forEach((el: Element) => observer.observe(el));

    const statsBar = this.el.nativeElement.querySelector('.stats-bar');
    if (statsBar) {
      const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const nums = this.el.nativeElement.querySelectorAll('.stat-num');
            this.animateCount(nums[0], 30, '+', 1000);
            this.animateCount(nums[1], 85, 'K+', 1200);
            statsObserver.disconnect();
          }
        });
      }, { threshold: 0.5 });
      statsObserver.observe(statsBar);
    }
  }

  animateCount(el: HTMLElement, target: number, suffix: string, duration: number) {
    const start = performance.now();
    el.classList.add('counting');
    const update = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.floor(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(update);
      else { el.textContent = target + suffix; el.classList.remove('counting'); }
    };
    requestAnimationFrame(update);
  }

  fillSearch(tag: string) {
    this.searchQuery = tag;
    this.submitSearch();
  }

  submitSearch() {
    const q = this.searchQuery.trim();
    this.router.navigate(['/deals'], { queryParams: q ? { q } : {} });
  }

  storeName(id: string): string { return this.storeMap()[id] || `Store ${id}`; }

  dealUrl(dealID: string): string {
    return `https://www.cheapshark.com/redirect?dealID=${dealID}`;
  }
}
