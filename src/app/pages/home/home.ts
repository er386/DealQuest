import { Component, AfterViewInit, ElementRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Navbar } from '../../components/navbar/navbar';

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, Navbar],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements AfterViewInit {
  searchQuery = '';

  constructor(private el: ElementRef) {}

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
  }
}
