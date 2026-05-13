import { Component, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Navbar } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { CheapSharkService } from '../../services/cheapshark.service';
import { WishlistService } from '../../services/wishlist.service';
import { CommentsService, Comment } from '../../services/comments.service';

interface GameDeal {
  storeID: string;
  dealID: string;
  price: string;
  retailPrice: string;
  savings: string;
}

interface GameInfo {
  info: { title: string; steamAppID: string | null; thumb: string };
  cheapestPriceEver: { price: string; date: number };
  deals: GameDeal[];
}

@Component({
  selector: 'app-game',
  imports: [CommonModule, FormsModule, RouterLink, Navbar],
  templateUrl: './game.html',
  styleUrl: './game.css',
})
export class Game implements OnInit {
  gameID = signal<string>('');
  game = signal<GameInfo | null>(null);
  storeMap = signal<Record<string, string>>({});
  comments = signal<Comment[]>([]);
  loading = signal(false);
  loadingComments = signal(false);
  error = signal('');
  commentError = signal('');

  newComment = '';
  posting = signal(false);
  deletingId = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public auth: AuthService,
    private cheapshark: CheapSharkService,
    public wishlist: WishlistService,
    private commentsApi: CommentsService,
  ) {}

  ngOnInit() {
    this.cheapshark.getStoreMap().subscribe(m => this.storeMap.set(m));
    if (this.auth.isLoggedIn()) {
      this.wishlist.load().subscribe({ error: () => {} });
    }

    this.route.paramMap.subscribe(params => {
      const id = params.get('gameID') || '';
      this.gameID.set(id);
      if (id) {
        this.fetchGame(id);
        this.fetchComments(id);
      }
    });
  }

  private fetchGame(id: string) {
    this.loading.set(true);
    this.error.set('');
    this.cheapshark.getGame(id).subscribe({
      next: (g: GameInfo) => {
        this.game.set(g);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not load game.');
        this.loading.set(false);
      },
    });
  }

  private fetchComments(id: string) {
    this.loadingComments.set(true);
    this.commentError.set('');
    this.commentsApi.load(id).subscribe({
      next: list => {
        this.comments.set(list);
        this.loadingComments.set(false);
      },
      error: () => {
        this.commentError.set('Could not load comments.');
        this.loadingComments.set(false);
      },
    });
  }

  storeName(id: string): string {
    return this.storeMap()[id] || `Store ${id}`;
  }

  dealUrl(dealID: string): string {
    return `https://www.cheapshark.com/redirect?dealID=${dealID}`;
  }

  steamAppLink(deal: GameDeal): string | null {
    if (deal.storeID !== '1') return null;
    const appid = this.game()?.info.steamAppID;
    return appid ? `steam://run/${appid}` : null;
  }

  cheapestDeal = computed(() => {
    const deals = this.game()?.deals;
    if (!deals?.length) return null;
    return [...deals].sort((a, b) => parseFloat(a.price) - parseFloat(b.price))[0];
  });

  isSaved(): boolean {
    return this.wishlist.has(this.gameID());
  }

  toggleWishlist() {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    const id = this.gameID();
    const g = this.game();
    if (!g) return;

    if (this.wishlist.has(id)) {
      this.wishlist.remove(id).subscribe();
    } else {
      const cheap = this.cheapestDeal();
      this.wishlist.add({
        gameID: id,
        dealID: cheap?.dealID,
        title: g.info.title,
        thumb: g.info.thumb,
        storeID: cheap?.storeID,
        salePrice: cheap?.price,
        normalPrice: cheap?.retailPrice,
      }).subscribe();
    }
  }

  submitComment() {
    const body = this.newComment.trim();
    if (!body) return;
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.posting.set(true);
    this.commentError.set('');
    this.commentsApi.post(this.gameID(), body).subscribe({
      next: () => {
        this.newComment = '';
        this.comments.set(this.commentsApi.items());
        this.posting.set(false);
      },
      error: () => {
        this.commentError.set('Failed to post comment.');
        this.posting.set(false);
      },
    });
  }

  canDelete(c: Comment): boolean {
    if (!this.auth.isLoggedIn()) return false;
    if (this.auth.isAdmin()) return true;
    return c.username === this.auth.getUsername();
  }

  deleteComment(c: Comment) {
    if (!confirm('Delete this comment?')) return;
    this.deletingId.set(c._id);
    this.commentsApi.remove(c._id).subscribe({
      next: () => {
        this.comments.set(this.commentsApi.items());
        this.deletingId.set(null);
      },
      error: () => {
        this.deletingId.set(null);
        this.commentError.set('Failed to delete comment.');
      },
    });
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  savingsPct(deal: GameDeal): number {
    const sale = parseFloat(deal.price);
    const retail = parseFloat(deal.retailPrice);
    if (retail <= 0) return 0;
    return Math.round(((retail - sale) / retail) * 100);
  }
}
