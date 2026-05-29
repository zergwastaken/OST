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
        <header class="nav-header">
            <a class="nav-brand" href="index.html">
                <img src="images/logo.png" alt="OS Tools Logo" class="nav-logo-img">
                <span class="nav-title">Operations Specialist Tools</span>
            </a>
            <nav class="nav-links">
                <a href="index.html" class="nav-link"><span class="nav-icon">🏠</span><span class="nav-text">Home</span></a>
                <a href="timer.html" class="nav-link"><span class="nav-icon">⏲️</span><span class="nav-text">Timer</span></a>
                <a href="cord-plotter.html" class="nav-link"><span class="nav-icon">📌</span><span class="nav-text">Cordinate Plotter</span></a>
                <a href="resources.html" class="nav-link"><span class="nav-icon">ℹ️</span><span class="nav-text">Resources</span></a>
            </nav>
        </header>`;
        document.body.insertAdjacentHTML("afterbegin", headerHTML);
    }

    // 5. Inject the Footer at the bottom of the body (if enabled)
    if (showFooter) {
        const footerHTML = `
        <footer class="main-footer">
            <!-- <p>Built with <a href="credits.html"> RAHHHH ❤️</a> for the fleet</p> -->
            <span>
                <a href="pixel.html" class="linkera tooltip" data-tooltip="pixel drawing">🎨</a>
                -
                <a href="credits.html" class="linkera tooltip" data-tooltip="credits & updates">❤️</a>
                -
                <a href="sar-le-game.html" class="linkera tooltip" data-tooltip="sar/le game!">🚨</a>
            </span>
            <!-- <p>© 2026 Operations Specialist Tools. Licensed under the MIT License.</p> -->
        </footer>`;
        document.body.insertAdjacentHTML("beforeend", footerHTML);
    }
});
