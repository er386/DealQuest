import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';

interface WishlistItem {
  id: number;
  title: string;
  store: string;
  thumb: string;
  price: number;
  original: number;
  discount: string;
  target: number;
}

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, FormsModule, Navbar],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css',
})
export class Wishlist {
  items: WishlistItem[] = [
    { id: 1, title: "The Witcher 3: Wild Hunt", store: "Steam", thumb: "https://cdn.akamai.steamstatic.com/steam/apps/292030/header.jpg", price: 7.99, original: 39.99, discount: "-80%", target: 10.00 },
    { id: 2, title: "Horizon Zero Dawn", store: "Steam", thumb: "https://cdn.akamai.steamstatic.com/steam/apps/1151640/header.jpg", price: 9.99, original: 49.99, discount: "-80%", target: 12.00 },
    { id: 3, title: "Cyberpunk 2077", store: "Steam", thumb: "https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg", price: 14.99, original: 59.99, discount: "-75%", target: 9.99 },
    { id: 4, title: "Elden Ring", store: "GOG", thumb: "https://cdn.akamai.steamstatic.com/steam/apps/1245620/header.jpg", price: 29.99, original: 59.99, discount: "-50%", target: 19.99 },
    { id: 5, title: "Baldur's Gate 3", store: "Steam", thumb: "https://cdn.akamai.steamstatic.com/steam/apps/1086940/header.jpg", price: 44.99, original: 59.99, discount: "-25%", target: 29.99 },
    { id: 6, title: "Red Dead Redemption 2", store: "Epic Games", thumb: "https://cdn.akamai.steamstatic.com/steam/apps/1174180/header.jpg", price: 19.99, original: 59.99, discount: "-67%", target: 14.99 },
  ];

  isDealMet(item: WishlistItem): boolean { return item.price <= item.target; }

  get totalGames() { return this.items.length; }
  get dealsMet() { return this.items.filter(i => this.isDealMet(i)).length; }

  remove(item: WishlistItem) {
    this.items = this.items.filter(i => i.id !== item.id);
  }

  aboveDiff(item: WishlistItem): string {
    return '$' + (item.price - item.target).toFixed(2) + ' above target';
  }
}
