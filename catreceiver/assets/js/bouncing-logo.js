(function () {
    var LOGO_WIDTH = 200;
    var LOGO_HEIGHT = 200;
    var SPEED = 3.5;

    var x = Math.random() * (window.innerWidth - LOGO_WIDTH);
    var y = Math.random() * (window.innerHeight - LOGO_HEIGHT);
    var dx = SPEED;
    var dy = SPEED;
    var logoEl = null;
    var isWhite = true;

    function init() {
        logoEl = document.createElement('img');
        logoEl.src = 'assets/images/whitecat.png';
        logoEl.alt = 'Bouncing Logo';
        logoEl.style.position = 'fixed';
        logoEl.style.top = '0px';
        logoEl.style.left = '0px';
        logoEl.style.width = LOGO_WIDTH + 'px';
        logoEl.style.height = 'auto';
        logoEl.style.zIndex = '0'; //behind
        logoEl.style.opacity = '0.5';
        logoEl.style.willChange = 'transform';
        logoEl.style.backfaceVisibility = 'hidden';
        logoEl.style.transform = 'translate3d(0,0,0)';

        document.body.insertBefore(logoEl, document.body.firstChild);

        window.addEventListener('resize', function () {
            //in bounds
            if (x + LOGO_WIDTH > window.innerWidth) x = window.innerWidth - LOGO_WIDTH;
            if (y + logoEl.offsetHeight > window.innerHeight) y = window.innerHeight - logoEl.offsetHeight;
        });

        requestAnimationFrame(update);
    }

    function toggleCat() {
        isWhite = !isWhite;
        logoEl.src = isWhite ? 'assets/images/whitecat.png' : 'assets/images/blackcat.png';
    }

    function update() {
        var boundsX = window.innerWidth - logoEl.offsetWidth;
        var boundsY = window.innerHeight - logoEl.offsetHeight;

        x += dx;
        y += dy;

        var hit = false;

        if (x >= boundsX) {
            x = boundsX;
            dx = -dx;
            hit = true;
        } else if (x <= 0) {
            x = 0;
            dx = -dx;
            hit = true;
        }

        if (y >= boundsY) {
            y = boundsY;
            dy = -dy;
            hit = true;
        } else if (y <= 0) {
            y = 0;
            dy = -dy;
            hit = true;
        }

        if (hit) {
            toggleCat();
        }

        logoEl.style.transform = 'translate3d(' + (x | 0) + 'px, ' + (y | 0) + 'px, 0)';

        if (document.body.classList.contains('streaming-mode')) {
            logoEl.style.display = 'none';
        } else {
            logoEl.style.display = 'block';
        }

        requestAnimationFrame(update);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
