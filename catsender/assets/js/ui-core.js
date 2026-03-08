class TooltipManager {
    constructor() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'custom-tooltip';
        document.body.appendChild(this.tooltip);
        this.activeElement = null;
        this.timer = null;
        this.delay = 500; // 500ms delay

        this.init();
    }

    init() {
        const stripTitle = (el) => {
            if (!el || !el.getAttribute) return;
            const title = el.getAttribute('title');
            if (title) {
                el.setAttribute('data-tooltip', title);
                el.removeAttribute('title');
            }
        };

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                const target = mutation.target;

                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) {
                            stripTitle(node);
                            node.querySelectorAll('[title]').forEach(stripTitle);
                        }
                    });
                }

                if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
                    stripTitle(target);
                }

                if (mutation.type === 'attributes' && mutation.attributeName === 'data-tooltip') {
                    if (this.activeElement === target && this.tooltip.classList.contains('visible')) {
                        const newText = target.getAttribute('data-tooltip');
                        if (newText) {
                            this.tooltip.textContent = newText;
                            this.updatePosition(target);
                        }
                    }
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ['title', 'data-tooltip']
        });

        document.querySelectorAll('[title]').forEach(stripTitle);

        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                const text = target.getAttribute('data-tooltip');
                if (text) {
                    this.startShowTimer(target, text);
                }
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                this.clearShowTimer();
                this.hide();
            }
        });

        document.addEventListener('mousedown', () => {
            this.hide();
        });
    }

    startShowTimer(element, text) {
        this.clearShowTimer();
        this.activeElement = element;
        this.timer = setTimeout(() => {
            this.show(element, text);
        }, this.delay);
    }

    clearShowTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    show(element, text) {
        this.tooltip.textContent = text;
        this.tooltip.classList.add('visible');
        this.updatePosition(element);
    }

    hide() {
        this.activeElement = null;
        this.tooltip.classList.remove('visible');
    }

    updatePosition(element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        let top = rect.top - tooltipRect.height - 8;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        if (top < 0) top = rect.bottom + 8;
        if (left < 0) left = 8;
        if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - 8;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }
}

function setupCustomSelects() {
    const selects = document.querySelectorAll('select.form-control:not(.replaced)');
    selects.forEach(select => {

        select.classList.add('replaced');

        const wrapper = document.createElement('div');
        wrapper.className = 'custom-select-wrapper';
        if (select.id) wrapper.dataset.origId = select.id;

        if (select.style.display === 'none') {
            wrapper.style.display = 'none';
        }

        const trigger = document.createElement('div');
        trigger.className = 'custom-select-trigger';

        const selectedOption = select.options[select.selectedIndex];
        trigger.textContent = selectedOption ? selectedOption.textContent : 'Select...';

        const optionsList = document.createElement('div');
        optionsList.className = 'custom-options';

        function buildOptions() {
            optionsList.innerHTML = '';
            Array.from(select.options).forEach(option => {
                const customOption = document.createElement('div');
                customOption.className = 'custom-option';
                if (option.selected) customOption.classList.add('selected');

                customOption.textContent = option.textContent;
                customOption.dataset.value = option.value;

                if (option.hasAttribute('data-i18n')) {
                    customOption.setAttribute('data-i18n', option.getAttribute('data-i18n'));
                }

                customOption.addEventListener('click', () => {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change'));

                    trigger.textContent = customOption.textContent;
                    optionsList.querySelectorAll('.custom-option').forEach(el => el.classList.remove('selected'));
                    customOption.classList.add('selected');

                    wrapper.classList.remove('open');
                    trigger.classList.remove('open');
                });

                optionsList.appendChild(customOption);
            });
        }

        buildOptions();

        select.parentNode.insertBefore(wrapper, select);
        select.parentNode.removeChild(select);
        wrapper.appendChild(select);
        select.style.display = 'none';

        wrapper.appendChild(trigger);
        wrapper.appendChild(optionsList);

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            // close others
            document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
                if (el !== wrapper) {
                    el.classList.remove('open');
                    el.querySelector('.custom-select-trigger').classList.remove('open');
                }
            });

            wrapper.classList.toggle('open');
            trigger.classList.toggle('open');
        });

        // attach rebuild to wrapper
        wrapper.rebuildOptions = () => {
            buildOptions();
            const sOpt = select.options[select.selectedIndex];
            if (sOpt) trigger.textContent = sOpt.textContent;
        };
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.custom-select-wrapper.open').forEach(el => {
            el.classList.remove('open');
            el.querySelector('.custom-select-trigger').classList.remove('open');
        });
    });
}

function refreshCustomSelect(selectId) {
    const wrapper = document.querySelector(`.custom-select-wrapper[data-orig-id="${selectId}"]`);
    if (wrapper && typeof wrapper.rebuildOptions === 'function') {
        wrapper.rebuildOptions();
    }
}

function updateCustomSelectsLanguage() {
    const wrappers = document.querySelectorAll('.custom-select-wrapper');
    wrappers.forEach(wrapper => {
        const select = wrapper.querySelector('select');
        const trigger = wrapper.querySelector('.custom-select-trigger');
        const customOptions = wrapper.querySelectorAll('.custom-option');

        if (!select) return;

        const selectedOption = select.options[select.selectedIndex];
        if (selectedOption && trigger) {
            trigger.textContent = selectedOption.textContent;
        }

        customOptions.forEach((cOpt, index) => {
            const nativeOpt = select.options[index];
            if (nativeOpt) {
                cOpt.textContent = nativeOpt.textContent;
            }
        });
    });
}

// utility functions
function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} `;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type} `;
    toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
            `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showConfirmation(title, message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    if (!modal) return;

    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;

    const confirmBtn = document.getElementById('confirm-action-btn');
    const newBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

    newBtn.focus();

    const handleKeydown = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            e.stopPropagation();
        } else if (e.key === 'ArrowLeft') {
            const cancel = modal.querySelector('.btn-ghost');
            if (cancel) cancel.focus();
        } else if (e.key === 'ArrowRight') {
            newBtn.focus();
        }
    };

    document.addEventListener('keydown', handleKeydown);

    function closeModal() {
        modal.classList.remove('active');
        document.removeEventListener('keydown', handleKeydown);
    }

    modal.onkeydown = null;

    newBtn.addEventListener('click', () => {
        closeModal();
        if (onConfirm) onConfirm();
    });

    const cancelBtn = modal.querySelector('.btn-ghost.modal-close');
    if (cancelBtn) {
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', closeModal);
    }

    const xBtn = modal.querySelector('.modal-header .modal-close');
    if (xBtn) {
        const newX = xBtn.cloneNode(true);
        xBtn.parentNode.replaceChild(newX, xBtn);
        newX.addEventListener('click', closeModal);
    }

    modal.classList.add('active');
}

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
}

function applyTheme(theme) {
    if (theme === 'light') {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }
}

function toggleSelectVisibility(id, show) {
    const wrapper = document.querySelector(`.custom-select-wrapper[data-orig-id="${id}"]`);
    if (wrapper) {
        wrapper.style.display = show ? 'block' : 'none';
        const select = wrapper.querySelector('select');
        if (select) select.style.display = 'none';
    } else {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? 'block' : 'none';
    }
}

window.TooltipManager = TooltipManager;
window.setupCustomSelects = setupCustomSelects;
window.refreshCustomSelect = refreshCustomSelect;
window.toggleSelectVisibility = toggleSelectVisibility;
window.updateCustomSelectsLanguage = updateCustomSelectsLanguage;
window.formatTime = formatTime;
window.showToast = showToast;
window.showConfirmation = showConfirmation;
window.switchPage = switchPage;
window.applyTheme = applyTheme;
