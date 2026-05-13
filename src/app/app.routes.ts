import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { Deals } from './pages/deals/deals';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Wishlist } from './pages/wishlist/wishlist';
import { Game } from './pages/game/game';
import { Account } from './pages/account/account';
import { Chat } from './pages/chat/chat';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'deals', component: Deals },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'wishlist', component: Wishlist },
  { path: 'games/:gameID', component: Game },
  { path: 'account', component: Account },
  { path: 'chat', component: Chat },
  { path: '**', redirectTo: '' }
];
