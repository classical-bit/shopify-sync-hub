import { ShopifyCollection } from "../shopify/schemas/collection/ShopifyCollection";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import Sentry from "../utils/Sentry";

export class CollectionServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CollectionServiceError";
    }
}

export class CollectionService {
    sCollections: ShopifyCollection[] = [];
    tCollections: ShopifyCollection[] = [];
    initialized = false;

    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
    }

    async init() {
        this.sCollections = await this.source.GetCollections();
        this.tCollections = await this.target.GetCollections();
        this.initialized = true;
    }

    async requireInit() {
        if (!this.initialized) {
            await this.init();
        }
    }

    async SyncCollection(sCollection: ShopifyCollection, tCollection: ShopifyCollection | undefined) {
        if (tCollection) {
            // No update
            Logger.debug(`Collection matched: ${sCollection.handle}{${sCollection.id}}`);
            return tCollection;
        }

        const newTCollection = await this.target.CreateCollection({
            handle: sCollection.handle,
            descriptionHtml: sCollection.descriptionHtml,
            title: sCollection.title,
            templateSuffix: sCollection.templateSuffix
        });
        Logger.info(`Created Collection: ${newTCollection.handle}{${newTCollection.id}}`);
        return newTCollection;
    }

    async SyncCollections() {
        await this.requireInit();
        let completedCollections = 0;
        const startTime = Date.now();

        for (const sCollection of this.sCollections) {
            const collectionStartTime = Date.now();
            const tCollection = this.tCollections.find(c => c.handle === sCollection.handle);
            try {
                await this.SyncCollection(sCollection, tCollection);
            } catch (err) {
                Logger.error(`Failed while sync collection, handle: ${sCollection.handle}`, err);
                Sentry.captureException(err);
            }

            const collectionElapsedTime = Date.now() - collectionStartTime;
            Logger.debug(`Sync completed for ${sCollection.handle} in ${(collectionElapsedTime / 1000).toFixed(2)} seconds.`);

            completedCollections++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerCollection = elapsedTime / completedCollections;
            const remainingTime = avgTimePerCollection * (this.sCollections.length - completedCollections);

            Logger.debug(
                `Completed ${completedCollections}/${this.sCollections.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }

        for (const tCollection of this.tCollections) {
            const sCollection = this.sCollections.find(c => c.handle === tCollection.handle);
            if (sCollection) continue;

            try {
                const deletedCollectionId = await this.target.DeleteCollection(tCollection.id);
                Logger.info(`Deleted garbage collection, handle: ${tCollection.handle} tid: ${deletedCollectionId}`);
            } catch (err) {
                Logger.error(`Failed while deleting garbage collection, handle: ${tCollection.handle} tid: ${tCollection.id}`, err);
                Sentry.captureException(err);
            }
        }
    }

    async GetTargetCollectionFromSource(gid: string): Promise<ShopifyCollection> {
        await this.requireInit();
        const sCollection = this.sCollections.find(collection => collection.id === gid);
        if (!sCollection) {
            throw new CollectionServiceError(`Colection not found at source, id: ${gid}`);
        }
        const tCollection = this.tCollections.find(collection => collection.handle === sCollection.handle);
        if (!tCollection) {
            throw new CollectionServiceError(`Colection not found at target, handle: ${sCollection.handle}`);
        }
        return tCollection;
    }

    async GetSourceCollectionById(gid: string): Promise<ShopifyCollection> {
        await this.requireInit();
        const collection = this.sCollections.find(collection => collection.id === gid);
        if (!collection) {
            throw new CollectionServiceError(`Colection not found at source, id: ${gid}`);
        }
        return collection;
    }

    async GetTargetCollectionById(gid: string): Promise<ShopifyCollection> {
        await this.requireInit();
        const collection = this.tCollections.find(collection => collection.id === gid);
        if (!collection) {
            throw new CollectionServiceError(`Colection not found at target, id: ${gid}`);
        }
        return collection;
    }

    async GetSourceCollectionByHandle(handle: string): Promise<ShopifyCollection> {
        await this.requireInit();
        const collection = this.sCollections.find(collection => collection.handle === handle);
        if (!collection) {
            throw new CollectionServiceError(`Colection not found at source, handle: ${handle}`);
        }
        return collection;
    }

    async GetTargetCollectionByHandle(handle: string): Promise<ShopifyCollection> {
        await this.requireInit();
        const collection = this.tCollections.find(collection => collection.handle === handle);
        if (!collection) {
            throw new CollectionServiceError(`Colection not found at target, handle: ${handle}`);
        }
        return collection;
    }
}