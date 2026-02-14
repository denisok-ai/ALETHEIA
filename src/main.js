/**
 * @file: main.js
 * @description: Поведение лендинга ALETHEIA — меню, форма, анимации при скролле (Intersection Observer).
 * @dependencies: нет
 * @created: 2025-02-14
 */

(function () {
  const burger = document.querySelector('.header__burger');
  const nav = document.querySelector('.nav');

  if (burger && nav) {
    burger.addEventListener('click', function () {
      nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', nav.classList.contains('is-open'));
    });
    document.querySelectorAll('.nav__link').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  const form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const text = btn.textContent;
      btn.textContent = 'Отправка…';
      btn.disabled = true;
      setTimeout(function () {
        btn.textContent = 'Заявка отправлена';
        setTimeout(function () {
          btn.textContent = text;
          btn.disabled = false;
          form.reset();
        }, 2000);
      }, 500);
    });
  }

  // Scroll-triggered reveal с каскадной задержкой
  const revealEls = document.querySelectorAll('.reveal');
  const STAGGER_MS = 90;
  const observerOptions = { root: null, rootMargin: '0px 0px -80px 0px', threshold: 0.1 };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const delay = parseInt(el.getAttribute('data-delay'), 10);
      const ms = isNaN(delay) ? 0 : delay * STAGGER_MS;
      setTimeout(function () {
        el.classList.add('is-visible');
      }, ms);
    });
  }, observerOptions);

  revealEls.forEach(function (el) { observer.observe(el); });

  // Параллакс hero-фона
  const heroBg = document.querySelector('.hero__bg-img');
  if (heroBg) {
    window.addEventListener('scroll', function () {
      const hero = document.getElementById('hero');
      if (!hero) return;
      const rect = hero.getBoundingClientRect();
      const h = hero.offsetHeight;
      if (rect.top < h && rect.bottom > 0) {
        const progress = Math.max(0, 1 - rect.top / h);
        heroBg.style.transform = 'translate3d(0, ' + progress * 6 + 'px, 0) scale(1.02)';
      } else {
        heroBg.style.transform = '';
      }
    }, { passive: true });
  }
})();
