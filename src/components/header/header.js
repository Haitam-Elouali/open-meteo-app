document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    if (!header) return;

    const hamburger = header.querySelector('.header__hamburger');
    const nav = header.querySelector('.header__nav');
    if (!hamburger || !nav) return;

    // Backdrop overlay for the slide-in mobile menu.
    const overlay = document.createElement('div');
    overlay.className = 'header__menu-overlay';
    document.body.appendChild(overlay);

    const closeNav = () => {
        header.classList.remove('is-menu-open');
        hamburger.setAttribute('aria-expanded', 'false');
        overlay.classList.remove('is-visible');
    };

    const openNav = () => {
        header.classList.add('is-menu-open');
        hamburger.setAttribute('aria-expanded', 'true');
        overlay.classList.add('is-visible');
    };

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (header.classList.contains('is-menu-open')) {
            closeNav();
        } else {
            openNav();
        }
    });

    overlay.addEventListener('click', closeNav);

    nav.querySelectorAll('.header__nav-link').forEach((link) => {
        link.addEventListener('click', closeNav);
    });

    // Clicking the dark area of the drawer (but not a link) closes it.
    nav.addEventListener('click', (e) => {
        if (e.target === nav) closeNav();
    });

    document.addEventListener('click', (e) => {
        if (!header.contains(e.target)) {
            closeNav();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeNav();
        }
    });
});
