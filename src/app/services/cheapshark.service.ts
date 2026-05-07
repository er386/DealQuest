import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, shareReplay, map } from 'rxjs';

const BASE = 'https://www.cheapshark.com/api/1.0';

export interface Deal {
  dealID: string;
  gameID: string;
  storeID: string;
  title: string;
  salePrice: string;
  normalPrice: string;
  savings: string;
  thumb: string;
  steamAppID: string | null;
  metacriticScore: string;
  steamRatingPercent: string;
  releaseDate: number;
}

export interface Store {
  storeID: string;
  storeName: string;
  isActive: number;
  images: { banner: string; logo: string; icon: string };
}

export interface DealQuery {
  title?: string;
  storeID?: string;
  upperPrice?: number;
  lowerPrice?: number;
  sortBy?: 'Deal Rating' | 'Title' | 'Savings' | 'Price' | 'Metacritic' | 'Reviews' | 'Release' | 'Store' | 'Recent';
  desc?: 0 | 1;
  pageSize?: number;
  pageNumber?: number;
  onSale?: 0 | 1;
}

@Injectable({ providedIn: 'root' })
export class CheapSharkService {
  private storesCache$?: Observable<Store[]>;

  constructor(private http: HttpClient) {}

  getStores(): Observable<Store[]> {
    if (!this.storesCache$) {
      this.storesCache$ = this.http.get<Store[]>(`${BASE}/stores`).pipe(shareReplay(1));
    }
    return this.storesCache$;
  }

  getStoreMap(): Observable<Record<string, string>> {
    return this.getStores().pipe(
      map(stores => Object.fromEntries(stores.map(s => [s.storeID, s.storeName])))
    );
  }

  getDeals(query: DealQuery = {}): Observable<Deal[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        params = params.set(k, String(v));
      }
    }
    return this.http.get<Deal[]>(`${BASE}/deals`, { params });
  }

  getGame(gameID: string): Observable<any> {
    return this.http.get(`${BASE}/games`, { params: new HttpParams().set('id', gameID) });
  }

  dealRedirectUrl(dealID: string): string {
    return `${BASE}/deals?id=${dealID}`;
  }
}
