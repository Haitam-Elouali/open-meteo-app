document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    if (!header) return;

    const hamburger = header.querySelector('.header__hamburger');
    const nav = header.querySelector('.header__nav');
    const mobileMenu = header.querySelector('.header__mobile-menu');
    const mobileNavLinks = header.querySelectorAll('.header__mobile-nav-link');

    if (!hamburger || !mobileMenu) return;

    const closeNav = () => {
        header.classList.remove('is-menu-open');
        hamburger.setAttribute('aria-expanded', 'false');
    };

    const openNav = () => {
        header.classList.add('is-menu-open');
        hamburger.setAttribute('aria-expanded', 'true');
    };

    hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = header.classList.contains('is-menu-open');
        if (isOpen) {
            closeNav();
        } else {
            openNav();
        }
    });

    mobileNavLinks.forEach((link) => {
        link.addEventListener('click', () => {
            closeNav();
        });
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
