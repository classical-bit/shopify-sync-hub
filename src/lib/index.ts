import { SyncService } from "./services/SyncService";
import { Logger } from "./utils/Logger";
import Sentry from "./utils/Sentry";

export async function main() {
    const startTime = Date.now();
    Logger.info("Starting Sync!");
    try {
        const syncService = new SyncService();
        // await syncService.fileService.SyncFiles();
        // await syncService.collectionService.SyncCollections();
        // await syncService.productService.SyncProducts();
        // await syncService.pageService.SyncPages();
        // await syncService.pageService.SyncMenus();

        // await syncService.metaobjectDefService.SyncMetaobjectDefinitions();
        // await syncService.metafieldDefService.SyncMetafieldDefinitions();

        await syncService.productService.SyncProductsMetafields();
    } catch (err) {
        Sentry.captureException(err);
        Logger.error('Main failed:', err);
        process.exit(1);
    } finally {
        await Sentry.close(2000);
    }
    const elapsedTime = Date.now() - startTime;
    Logger.info(`Finished Sync! Time: ${(elapsedTime / 1000).toFixed(2)} seconds.`);
}