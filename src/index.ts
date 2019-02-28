/**
 * The MIT License
 *
 * Copyright (c) 2019 Alexis Bize <alexis.bize@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
// *** HELPERS *** /

const matchQueryValue = (regex: RegExp, defaultValue: any): string => {
    const queryValue = window.location.search.match(regex);
    return queryValue === null || queryValue[1] === void 0
        ? String(defaultValue)
        : String(queryValue[1]);
};

const getGravityAxisValue = (
    accelerationIncludingGravity: DeviceAcceleration
): number => {
    const { x, y } = accelerationIncludingGravity;
    return window.innerHeight > window.innerWidth
        ? parseInt(String(x || 0), 10)
        : parseInt(String(y || 0), 10);
};

const displayError = (err: Error | string, DOMElement: HTMLElement): void => {
    if (typeof err === 'string') err = new Error(err);
    DOMElement.innerHTML = `<p>${err.message}</p>`;
};

const isMotionEventSupported = (): boolean => 'DeviceMotionEvent' in window;

// *** OPTIONS *** /

const FRAMES_COUNT: number = (() => {
    const defaultValue = 6;
    const queryValue = matchQueryValue(/frames-count=([0-9]+)/, defaultValue);
    return Math.max(parseInt(queryValue, 10), 0);
})();

// *** DEFINITIONS *** /

let motionEventRegistered: boolean = false;
let frameIndexCache: number = 0;
let frameTransitionActive: boolean = false;

const framesB64CachedList: string[] = [];
const framesURIsList: string[] = (() => {
    const frames: string[] = [];
    while (frames.length < FRAMES_COUNT)
        frames.push(`./assets/frame-${frames.length + 1}.jpg`);
    return frames;
})();

const frameDOMRender: HTMLElement = document.getElementById(
    'render'
) as HTMLElement;

const infoDOMRender: HTMLElement = document.getElementById(
    'info'
) as HTMLElement;

// *** METHODS *** /

const handleMotionEvent = (event: DeviceMotionEvent): void => {
    motionEventRegistered = true;

    if (frameTransitionActive === false) {
        frameTransitionActive = true;
    } else return;

    const { accelerationIncludingGravity = null } = event;

    if (accelerationIncludingGravity === null) {
        frameTransitionActive = false;
        return;
    }

    const axisValue = getGravityAxisValue(accelerationIncludingGravity);

    if (Math.abs(axisValue % 2) !== 0) {
        frameTransitionActive = false;
        return;
    }

    const frameIndex: number = (() => {
        const middleFrameIndex: number = Math.ceil(
            framesB64CachedList.length / 2 - 1
        );

        if (axisValue === 0) {
            return middleFrameIndex;
        }

        if (axisValue < 0) {
            const previousFrameIndex = middleFrameIndex + axisValue + 1;
            return framesB64CachedList[previousFrameIndex] !== void 0
                ? previousFrameIndex
                : 0;
        }

        const nextFrameIndex = middleFrameIndex + axisValue - 1;
        return framesB64CachedList[nextFrameIndex] !== void 0
            ? nextFrameIndex
            : framesB64CachedList.length - 1;
    })();

    if (frameIndexCache === frameIndex) {
        frameTransitionActive = false;
        return;
    } else frameIndexCache = frameIndex;

    const img: HTMLImageElement = new Image();

    img.src = framesB64CachedList[frameIndex];
    img.crossOrigin = 'anonymous';

    img.onload = () => {
        frameDOMRender.style.backgroundImage = `url('${img.src}')`;

        if (frameDOMRender.classList.contains('lenticular-effect') === false) {
            frameDOMRender.classList.add('lenticular-effect');
        }

        setTimeout(() => {
            frameTransitionActive = false;
        }, 330 + 330 / 2);
    };

    img.onerror = () => {
        frameTransitionActive = false;
    };
};

const initializeDeviceMotionEvent = (): void => {
    window.addEventListener('devicemotion', handleMotionEvent, true);
    setTimeout(() => {
        motionEventRegistered === false &&
            displayError('Something went wrong. Your browser might not be supported.', infoDOMRender) &&
            frameDOMRender.classList.remove('lenticular-effect');
    }, 1000);
};

const preloadAssets = (cb: Function) => {
    Promise.all(
        framesURIsList.map(
            (frameURI: string) =>
                new Promise((resolve, reject) => {
                    const img: HTMLImageElement = new Image();

                    img.src = frameURI;
                    img.crossOrigin = 'anonymous';

                    img.onerror = () => {
                        reject(new Error(`Cannot load "${frameURI}"`));
                    };

                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const context = canvas.getContext('2d');

                        if (context === null) {
                            reject(new Error(`Cannot load "${frameURI}"`));
                            return;
                        }

                        context.drawImage(img, 0, 0);
                        const b64 = canvas.toDataURL('image/jpeg');
                        framesB64CachedList.push(b64);

                        resolve();
                    };
                })
        )
    )
        .then(() => cb(null))
        .catch((preloadError: Error) => {
            cb(preloadError);
        });
};

// *** START *** /

if (isMotionEventSupported()) {
    preloadAssets((preloadError: Error | null) => {
        if (preloadError !== null) displayError(preloadError.message, infoDOMRender);
        else initializeDeviceMotionEvent();
    });
} else displayError('Device not supported! :(', infoDOMRender);
