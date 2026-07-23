import { WebContainer } from '@webcontainer/api';

let webContainerInstance: WebContainer | null = null;

export const getWebContainer = async () => {
    if (webContainerInstance === null) {
        webContainerInstance = await WebContainer.boot();
    }
    return webContainerInstance;
};