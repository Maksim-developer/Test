let siteBlock = false;
let popupState = false;
let headerState = false;

// Modals model start ..............................
const popup = (function () {
    const modalOverlay = document.querySelector('.modal-overlay');
    if (!modalOverlay) return;

    document.addEventListener('DOMContentLoaded', () => {

        document.addEventListener('mousedown', (e) => { if (e.target === modalOverlay) close(); })

        document.addEventListener('click', (e) => { initTarget(e) });
    });

    const initTarget = (e) => {
        const target = e.target;

        if (target.classList.contains('modal-btn')) {
            e.preventDefault();
            const targetPath = target.getAttribute('data-path');
            if (targetPath) return open(targetPath);
        }
        if (e.target.classList.contains('modal-close')) e.preventDefault(), close();
    }

    const open = (targetPath) => {

        const targetEl = document.querySelector('[data-target="' + targetPath + '"]');
        if (!targetEl) {
            console.log('Target ' + targetPath + ' doesnt exist');
            return;
        }

        document.querySelectorAll('.modal--visible').forEach(modal => { modal.classList.remove('modal--visible'); });

        modalOverlay.classList.add('modal-overlay--visible');
        targetEl.classList.add('modal--visible');
        targetEl.dispatchEvent(new Event('popup-open', { bubbles: true }));
        popupState = true;
    }

    const close = () => {
        document.querySelectorAll('.modal--visible').forEach(modal => { modal.classList.remove('modal--visible'); });
        modalOverlay.classList.remove('modal-overlay--visible');
        document.dispatchEvent(new Event('popup-close', { bubbles: true }));
        popupState = false;
    }

    return { open: open, close: close }
})();
// Modals model end ..............................


window.onload = function () {
    const body = document.querySelector('body');

    // Functions blok page start ..............................
    const paddingOffset = window.innerWidth - document.body.offsetWidth;

    const blockScroll = () => {
        body.style.cssText += `overflow: hidden;`;
        body.style.setProperty('--offset-right', paddingOffset + 'px');
        siteBlock = !siteBlock;
    }

    const removeScroll = () => {
        body.style.cssText += `overflow: auto;`;
        body.style.setProperty('--offset-right', 0 + 'px');
        siteBlock = false;
    }
    // Functions blok page start ..............................

    // Custom helpers functions start ..............................
    const helpers = {

        hasClass: function (element, ...classes) {
            for (const className of classes) {
                if (!element.classList.contains(className)) {
                    return false;
                }
            }
            return true;
        },

        activeState: function (target, className = '--active') {
            if (!target) {
                return;
            }
            if (typeof target.classList === 'undefined') {
                return;
            }
            target.classList.add(className);
            return true;
        },

        removeState: function (target, className = '--active') {
            if (!target) {
                return;
            }
            if (typeof target.classList === 'undefined') {
                return;
            }
            target.classList.remove(className);
            return false;
        },

        toggleState: function (target, className = '--active') {
            target.classList.toggle(className);
            return true;
        },

        activeStateArr: function (target, className = '--active') {
            if (!target.length) return false
            target.forEach(element => {
                element.classList.add(className);
            });
        },

        removeStateArr: function (target, className = '--active') {
            if (!target.length) return false
            target.forEach(element => {
                element.classList.remove(className);
            });
        },

        debounce: function (method, delay, index) {
            clearTimeout(method.set);
            method.set = setTimeout(function () {
                method(index);
            }, delay);
        },

        testPhone: function (input) {
            if (!input) return console.error('Not input');

            const cleanedInput = input.value.replace(/[()\s-]/g, '');
            if (cleanedInput.length < 12) {
                return false;
            }
            const regex = /^[\+]?[0-9]+$/;
            return regex.test(cleanedInput);
        },

        testMail: function (input) {
            if (!input) return console.error('Not input');
            const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return regex.test(input.value);
        },

        testName: function (input) {
            if (!input) return console.error('Not input');
            if (input.value.trim() === "" || input.value.trim().length < 2) {
                return false;
            }
            const regex = /^[a-zA-Zа-яА-ЯёЁ0-9.\-]+$/i;
            return regex.test(input.value);
        },

        testCheckbox: function (item) {
            if (!item) return console.error('Not item');

            const input = item.querySelector('input');

            if (!input) return console.error('Not input');

            if (!input.checked) {
                helpers.activeState(item, '--error')
                return false;
            } else {
                helpers.removeState(item, '--error')
            }
        },

    };
    // Custom helpers functions start ..............................

    const ui = {
        CustomSlider: (function () {

            let mainSlider;

            const thumbsState = (e) => {
                const parent = e.el.closest('[data-parent]')

                if (!parent) {
                    return;
                }

                parent.querySelectorAll('[data-thumbs]').forEach((element, index) => {
                    if (index == e.realIndex) {
                        helpers.activeState(element, '--active')
                    } else {
                        helpers.removeState(element, '--active')
                    }
                });
            }

            const sliderState = (e) => {

                const parent = e.target.closest('[data-parent]');
                if (!parent) return;


                const sliderBtn = e.target.closest('[data-thumbs]');
                if (!sliderBtn) return;

                const thumbs = Array.from(parent.querySelectorAll('[data-thumbs]'));

                thumbs.forEach(el => {
                    if (el !== sliderBtn) {
                        helpers.removeState(el, '--active');
                    }
                });

                helpers.activeState(sliderBtn, '--active');

                const swiperEl = parent.querySelector('.swiper');
                if (!swiperEl || !swiperEl.swiper) return;

                const swiper = swiperEl.swiper;

                const index = thumbs.indexOf(sliderBtn);
                if (index === -1) return;

                const slideMethod = swiper.params.loop ? 'slideToLoop' : 'slideTo';

                swiper[slideMethod](index);
            };

            const initChange = (swiperEvent) => {
                if (!swiperEvent) {
                    return;
                }

                document.addEventListener('click', (e) => {
                    sliderState(e, swiperEvent)
                })

                swiperEvent.on('slideChange', thumbsState);
            }

            const initSlider = (swiperContainer, customPoints = null, thumbs = false) => {

                if (!swiperContainer) {
                    return;
                }

                if (!customPoints) {
                    customPoints = {
                        0: {
                            slidesPerView: 1,
                            spaceBetween: 15,
                        },
                    }
                }

                let customParams = '';

                if (thumbs === true) {
                    customParams = {
                        init: initChange,
                    }
                }

                const speedSlider = 800;

                const cardsSlider = swiperContainer.querySelector('.swiper');

                if (!cardsSlider) {
                    return;
                }

                const sliderPrev = swiperContainer.querySelector('.slider-arrows__btn.-prev')
                const sliderNext = swiperContainer.querySelector('.slider-arrows__btn.-next')
                const sliderLoop = cardsSlider.dataset.loop || false;
                const sliderPlay = cardsSlider.dataset.play || '';

                if (sliderPlay) {
                    sliderPlay = {
                        delay: 1200,
                        disableOnInteraction: false,
                    }
                }

                const indexSlider = new Swiper(cardsSlider, {
                    speed: speedSlider,
                    navigation: {
                        nextEl: sliderNext,
                        prevEl: sliderPrev,
                    },
                    loop: sliderLoop,
                    autoplay: sliderPlay,
                    breakpoints: customPoints,
                    on: customParams,
                });

                mainSlider = indexSlider;
            }

            const updateSlider = () => {
                mainSlider.update()
            }

            return {
                initSlider: initSlider,
                updateSlider: updateSlider
            }
        })(),
        ValidInput: (function (item) {
            let type = item.getAttribute('type');

            switch (type) {
                case 'tel':
                    if (!helpers.testPhone(item)) {
                        helpers.activeState(item.closest('.input'), '--error');
                        return false;
                    }
                    break;

                case 'email':
                    if (!helpers.testMail(item)) {
                        helpers.activeState(item.closest('.input'), '--error');
                        return false;
                    }
                    break;

                default:
                    if (!helpers.testName(item)) {
                        helpers.activeState(item.closest('.input'), '--error');
                        return false;
                    }
                    break;
            }

            helpers.removeState(item.closest('.input'), '--error');
        }),
        PhoneMask: (function () {
            const ensureHTMLElement = (obj) => {
                if (!(obj instanceof HTMLElement)) {
                    throw new TypeError('The provided object must be an instance of HTMLElement.');
                }
            };

            const phoneMaskHandler = (e) => {
                ensureHTMLElement(e.target);

                const inputPhone = e.target;

                if (!inputPhone.hasAttribute('data-phone')) {
                    return;
                }

                if (/^\+\s*7\s*$/.test(inputPhone.value)) {
                    inputPhone.value = '+ 7 (___) ___ - __ - __';
                    return;
                }

                if (inputPhone.selectionStart < 3) {
                    e.preventDefault();
                }

                const matrix = "+ 7 (___) ___ - __ - __";
                let i = 0;
                const def = matrix.replace(/\D/g, "");
                const val = inputPhone.value.replace(/\D/g, "");

                let newValue = matrix.replace(/[_\d]/g, function (a) {
                    return i < val.length ? val.charAt(i++) || def.charAt(i) : a
                });

                i = newValue.indexOf("_");

                if (i !== -1) {
                    i < 5 && (i = 3); // Ограничение ввода символов до первой цифры
                    newValue = newValue.slice(0, i)
                }

                let reg = matrix.substring(0, inputPhone.value.length).replace(/_+/g,
                    function (a) { return "\\d{1," + a.length + "}" }).replace(/[+()]/g, "\\$&");

                const finalReq = new RegExp("^" + reg + "$");

                const condition = !finalReq.test(inputPhone.value) ||
                    inputPhone.value.length < 5 ||
                    e.keyCode > 47 && e.keyCode < 58;

                if (condition) {
                    inputPhone.value = newValue;
                }

                if (e.type === "blur" && inputPhone.value.length < 5) {
                    inputPhone.value = '';
                }
            };

            const init = (element) => {
                ensureHTMLElement(element);

                element.addEventListener("input", phoneMaskHandler);
                element.addEventListener("focus", phoneMaskHandler);
                element.addEventListener("blur", phoneMaskHandler);
                element.addEventListener("keydown", phoneMaskHandler);
            };

            return {
                init: init
            };
        })(),
    }

    const header = document.querySelector('.header');
    const menu = this.document.querySelector('.header__middle');


    let customDistance = 600;
    const scrollTarget = document.querySelector('[data-header]');

    if (scrollTarget) {
        customDistance = scrollTarget.offsetHeight;
    }

    const headerOpen = () => {
        blockScroll()
        helpers.activeState(header, "--active");
        helpers.activeState(menu, "--active");
    }
    const headerClose = () => {
        removeScroll()
        helpers.removeState(header, '--active');
        helpers.removeState(menu, '--active');
    }

    const headerChange = (e) => {
        if (window.innerWidth > 1100) return;
        if (!e || !e.target) return;

        const burger = e.target.closest('.burger');

        if (burger) {
            burger.classList.toggle('--open');
            headerState = !headerState;
            if (headerState) headerOpen();
            else headerClose();
            return;
        }

        if (!menu || !menu.contains(e.target)) {
            headerState = false;
            headerClose();
        }
    };


    document.addEventListener('click', headerChange);


    // Init header size start ..............................
    const headerSize = () => {
        body.style.setProperty('--header-size', header.offsetHeight + 'px');
    }

    const headerScrollSize = () => {
        body.style.setProperty('--header-scroll', header.offsetHeight + 'px');
    }
    headerScrollSize();
    // Init header size start ..............................

    headerSize()


    window.addEventListener('resize', (e) => {
        helpers.debounce(headerSize, 100)
    });

    window.addEventListener('orientationchange', (e) => {
        helpers.debounce(headerSize, 100)
    });


    // Sliders start ..............................
    const product = this.document.querySelectorAll('.product');
    product.forEach(element => {
        ui.CustomSlider.initSlider(element, null, true)
    });
    // Sliders end ..............................


    // Phone mask start ..............................
    const phoneInput = this.document.querySelectorAll('[data-phone]');
    phoneInput.forEach(ui.PhoneMask.init);
    // Phone mask end ..............................

    // Form validate and uor ajax start ..............................
    const formValidate = (e) => {
        const form = e.target.closest('.form')

        console.log("form")

        if (!form) {
            return;
        }

        e.preventDefault();

        const formRequired = form.querySelectorAll('[data-required]');
        formRequired.forEach(ui.ValidInput);

        const formCheckbox = form.querySelector('.checkbox');
        helpers.testCheckbox(formCheckbox)

    }
    document.addEventListener('submit', formValidate)
    // Form validate and uor ajax end ..............................



    document.addEventListener('popup-open', blockScroll);
    document.addEventListener('popup-close', headerState ? '' : removeScroll);

}