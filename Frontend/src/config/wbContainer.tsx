import { WebContainer } from '@webcontainer/api';

let webContainerInstance: WebContainer | null = null;
let bootPromise: Promise<WebContainer> | null = null;

export const getWebContainer = async (): Promise<WebContainer> => {
    if (webContainerInstance) {
        return webContainerInstance;
    }

    // WebContainer requires cross-origin isolation (COOP + COEP headers).
    // If it's not active, boot() fails with a cryptic error — check this first
    // so the real cause is obvious.
    if (typeof crossOriginIsolated !== 'undefined' && !crossOriginIsolated) {
        throw new Error(
            'WebContainer requires cross-origin isolation. ' +
            'The page is NOT cross-origin isolated (crossOriginIsolated === false). ' +
            'Ensure the server sends "Cross-Origin-Opener-Policy: same-origin" and ' +
            '"Cross-Origin-Embedder-Policy: require-corp" (see vercel.json) and hard-reload.'
        );
    }

    // Reuse an in-flight boot so concurrent callers don't boot twice.
    if (!bootPromise) {
        bootPromise = WebContainer.boot();
    }

    try {
        webContainerInstance = await bootPromise;
        return webContainerInstance;
    } catch (err) {
        bootPromise = null; // allow a retry on next call
        console.error('[WebContainer] boot failed:', err);
        throw err;
    }
};
