document.addEventListener("DOMContentLoaded", () => {
    // Locate script element to read page configuration parameters
    const currentScript = document.querySelector('script[src*="header-footer.js"]');
    
    // Default to true unless explicitly set to "false"
    const showHeader = currentScript ? currentScript.getAttribute('data-header') !== 'false' : true;
    const showFooter = currentScript ? currentScript.getAttribute('data-footer') !== 'false' : true;

    // 1. Setup the layout wrapper on the body
    document.body.classList.add("site-wrapper");

    // 2. Wrap existing content in a main wrapper (if not already wrapped)
    // if (!document.querySelector('.main-content')) {
    //     const bodyContent = document.body.innerHTML;
    //     document.body.innerHTML = `<main class="main-content">${bodyContent}</main>`;
    // }

    // 3. Inject the CSS Stylesheet link if it is not present
    if (!document.querySelector('link[href*="style.css"]')) {
        const cssLink = document.createElement("link");
        cssLink.rel = "stylesheet";
        cssLink.href = "css/style.css";
        document.head.appendChild(cssLink);
    }

    // 4. Inject the Header at the top of the body (if enabled)
    if (showHeader) {
        const headerHTML = `
        <header id="headerNav" class="nav-header">
            <a class="nav-brand" href="index.html">
                <img src="images/logo.png" alt="OS Tools Logo" class="nav-logo-img">
                <span class="nav-title">Operations Specialist Tools</span>
            </a>
            <nav class="nav-links" id="primary-navigation" aria-label="Primary navigation">
                <a href="index.html" class="nav-link"><span class="nav-icon">🏠</span><span class="nav-text">Home</span></a>
                <a href="timer.html" class="nav-link"><span class="nav-icon">⏲️</span><span class="nav-text">Timer</span></a>
                <a href="cord-plotter.html" class="nav-link"><span class="nav-icon">🗺️</span><span class="nav-text">Map Tools</span></a>
                <a href="resources.html" class="nav-link"><span class="nav-icon">ℹ️</span><span class="nav-text">Resources</span></a>
            </nav>
        </header>`;
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
    }

    // Enhance the injected navigation and page-specific headers (such as the game page).
    const navHeader = document.querySelector('.nav-header');
    if (navHeader) {
        const nav = navHeader.querySelector('.nav-links');
        if (nav) {
            if (!nav.id) nav.id = 'primary-navigation';
            if (!nav.getAttribute('aria-label')) nav.setAttribute('aria-label', 'Primary navigation');

            let toggle = navHeader.querySelector('.nav-toggle');
            if (!toggle) {
                toggle = document.createElement('button');
                toggle.className = 'nav-toggle';
                toggle.type = 'button';
                toggle.setAttribute('aria-controls', nav.id);
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-label', 'Open navigation menu');
                toggle.innerHTML = '<span class="nav-toggle-icon" aria-hidden="true"></span>';
                nav.before(toggle);
            }

            const mobileQuery = window.matchMedia('(max-width: 900px)');
            const closeMenu = (restoreFocus = false) => {
                navHeader.classList.remove('nav-open');
                toggle.setAttribute('aria-expanded', 'false');
                toggle.setAttribute('aria-label', 'Open navigation menu');
                if (restoreFocus) toggle.focus();
            };

            toggle.addEventListener('click', () => {
                const isOpening = toggle.getAttribute('aria-expanded') !== 'true';
                navHeader.classList.toggle('nav-open', isOpening);
                toggle.setAttribute('aria-expanded', String(isOpening));
                toggle.setAttribute('aria-label', isOpening ? 'Close navigation menu' : 'Open navigation menu');
            });

            nav.addEventListener('click', event => {
                if (event.target.closest('a')) closeMenu();
            });
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && navHeader.classList.contains('nav-open')) closeMenu(true);
            });
            document.addEventListener('click', event => {
                if (mobileQuery.matches && navHeader.classList.contains('nav-open') && !navHeader.contains(event.target)) closeMenu();
            });
            const resetOnBreakpointChange = () => closeMenu();
            if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', resetOnBreakpointChange);
            else mobileQuery.addListener(resetOnBreakpointChange);

            const currentPage = location.pathname.split('/').pop() || 'index.html';
            nav.querySelectorAll('a[href]').forEach(link => {
                if (new URL(link.href, location.href).pathname.split('/').pop() === currentPage) {
                    link.setAttribute('aria-current', 'page');
                }
            });
        }
    }

    // 5. Inject the Footer at the bottom of the body (if enabled)
    if (showFooter) {
        const footerHTML = `
        <footer class="main-footer">
            <span>
                <a href="pixel.html" class="linkera tooltip" data-tooltip="minigames">🧩</a>
                -
                <a href="credits.html" class="linkera tooltip" data-tooltip="credits & updates">❤️</a>
                -
                <a href="https://zergwastaken.github.io/OWS/" target="_blank" class="linkera tooltip" data-tooltip="shenanigans">👾</a>
            </span>
            <!-- <p>© 2026 Operations Specialist Tools. Licensed under the MIT License.</p> -->
        </footer>`;
        document.body.insertAdjacentHTML("beforeend", footerHTML);
    }
});
