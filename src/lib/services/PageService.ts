import { ShopifyCustomerAccountPage } from "../shopify/schemas/store/ShopifyCustomerAccountPage";
import { ShopifyMenu, ShopifyMenuItem, ShopifyMenuItemCreateInput } from "../shopify/schemas/store/ShopifyMenu";
import { ShopifyPage } from "../shopify/schemas/store/ShopifyPage";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import Sentry from "../utils/Sentry";
import { CollectionService } from "./CollectionService";
import { MetafieldService } from "./MetafieldService";

export class PageServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PageServiceError";
    }
}

export class PageService {
    sPages: ShopifyPage[] = [];
    tPages: ShopifyPage[] = [];
    sCustomerAccountPages: ShopifyCustomerAccountPage[] = [];
    tCustomerAccountPages: ShopifyCustomerAccountPage[] = [];
    initialized = false;
    private metafieldService;
    private collectionService;

    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
        this.metafieldService = new MetafieldService(source, target);
        this.collectionService = new CollectionService(source, target);
    }

    async init() {
        this.sPages = await this.source.GetPages();
        this.tPages = await this.target.GetPages();
        this.initialized = true;
    }

    async requireInit() {
        if (!this.initialized) {
            await this.init();
        }
    }

    async SyncPage(sPage: ShopifyPage, tPage: ShopifyPage | undefined) {
        if (tPage) {
            for (const sMetafield of sPage.metafields.nodes) {
                const tMetafield = tPage.metafields.nodes.find(mf => mf.namespace === sMetafield.namespace && mf.key === sMetafield.key);
                await this.metafieldService.SyncMetafield(tPage.id, sMetafield, tMetafield);
            }
            return tPage;
        }

        Logger.debug(`Page not found at target with handle: ${sPage.handle}`);
        const newTPage = await this.target.CreatePage({
            handle: sPage.handle,
            title: sPage.title,
            body: sPage.body,
            isPublished: sPage.isPublished,
            templateSuffix: sPage.templateSuffix
        });
        this.tPages.push(newTPage);
        Logger.info(`New page created at target id: ${newTPage.id}`);
        for (const sMetafield of sPage.metafields.nodes) {
            const tMetafield = newTPage.metafields.nodes.find(mf => mf.namespace === sMetafield.namespace && mf.key === sMetafield.key);
            await this.metafieldService.SyncMetafield(newTPage.id, sMetafield, tMetafield);
        }
        return newTPage;
    }

    async SyncPages() {

        await this.requireInit();

        Logger.debug("Sync content/pages");

        let completedCounts = 0;
        const startTime = Date.now();

        for (const sPage of this.sPages) {
            const countStartTime = Date.now();
            Logger.debug(`Processing page: ${sPage.title}(${sPage.handle}){${sPage.id}}`);

            const tPage = this.tPages.find(p => p.handle === sPage.handle);

            try {
                await this.SyncPage(sPage, tPage);
            } catch (err) {
                const processHandleString = "SyncPage";
                Logger.error(`Failed to process handle: ${processHandleString}`, err);
                Sentry.captureException(err, { tags: { section: processHandleString } });
            }

            const countElapsedTime = Date.now() - countStartTime;
            Logger.debug(`Sync completed for ${sPage.handle} in ${(countElapsedTime / 1000).toFixed(2)} seconds.`);

            completedCounts++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerCount = elapsedTime / completedCounts;
            const remainingTime = avgTimePerCount * (this.sPages.length - completedCounts);

            Logger.debug(
                `Completed ${completedCounts}/${this.sPages.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }
    }

    async IsMenuMatch(sMenu: ShopifyMenu, tMenu: ShopifyMenu) {
        if (sMenu.title !== tMenu.title) return false;
        return await this.IsMenuItemsMatch(sMenu.items, tMenu.items);
    }

    static GetResourceTypeFromID(resourceId: string) {
        return resourceId.split('/').slice(3, 4).pop();
    }

    async IsMenuItemsMatch(sMenuItems: ShopifyMenuItem[], tMenuItems: ShopifyMenuItem[]) {
        if (!sMenuItems.length && !tMenuItems.length) return true;
        if (sMenuItems.length !== tMenuItems.length) return false;

        for (const sMenuItem of sMenuItems) {
            const tMenuItem = tMenuItems.find(menuItem => menuItem.title === sMenuItem.title &&
                menuItem.type === sMenuItem.type
            );
            if (!tMenuItem) return false;
            if (sMenuItem.url !== tMenuItem.url) return false;

            if (sMenuItem.resourceId) {
                if (!tMenuItem.resourceId) return false;
                switch (PageService.GetResourceTypeFromID(sMenuItem.resourceId)) {
                    case "Page":
                        const sMenuItemPage = this.sPages.find(pg => pg.id === sMenuItem.resourceId);
                        if (!sMenuItemPage) throw new PageServiceError(`Page not found at source with id: ${sMenuItem.resourceId}`)
                        const tMenuItemPage = this.tPages.find(pg => pg.id === tMenuItem.resourceId);
                        if (!tMenuItemPage) throw new PageServiceError(`Page not found at target with id: ${tMenuItem.resourceId}`)
                        if (sMenuItemPage.handle !== tMenuItemPage.handle) return false;
                        break;
                    case "CustomerAccountPage":
                        const sMenuItemCustomerAccountPage = this.sCustomerAccountPages.find(pg => pg.id === sMenuItem.resourceId);
                        if (!sMenuItemCustomerAccountPage) throw new PageServiceError(`CustomerAccountPage not found at source with id: ${sMenuItem.resourceId}`)
                        const tMenuItemCustomerAccountPage = this.tCustomerAccountPages.find(pg => pg.id === tMenuItem.resourceId);
                        if (!tMenuItemCustomerAccountPage) throw new PageServiceError(`CustomerAccountPage not found at target with id: ${tMenuItem.resourceId}`)
                        if (sMenuItemCustomerAccountPage.handle !== tMenuItemCustomerAccountPage.handle) return false;
                        break;
                    case "Collection":
                        const sMenuItemCollection = await this.collectionService.GetSourceCollectionById(sMenuItem.resourceId);
                        const tMenuItemCollection = await this.collectionService.GetSourceCollectionById(tMenuItem.resourceId);
                        if (sMenuItemCollection.handle !== tMenuItemCollection.handle) return false;
                        break;
                    case "Product":
                        const sMenuItemProduct = await this.source.GetProduct(sMenuItem.resourceId);
                        if (!sMenuItemProduct) throw new PageServiceError(`Product not found at source with id: ${sMenuItem.resourceId}`)
                        const tMenuItemProduct = await this.target.GetProduct(tMenuItem.resourceId);
                        if (!tMenuItemProduct) throw new PageServiceError(`Product not found at target with id: ${tMenuItem.resourceId}`)
                        if (sMenuItemProduct.handle !== tMenuItemProduct.handle) return false;
                        break;
                    default: throw new PageServiceError(`Menu item resource not supported: ${sMenuItem.resourceId}`);
                }
            }
            if (sMenuItem.items) {
                if (!tMenuItem.items) return false;
                if (!(await this.IsMenuItemsMatch(sMenuItem.items, tMenuItem.items))) return false;
            }
        }
        return true;
    }

    async SyncMenus() {
        await this.requireInit();
        this.sCustomerAccountPages = await this.source.GetCustomerAccountPages();
        this.tCustomerAccountPages = await this.target.GetCustomerAccountPages();
        const sMenus = await this.source.GetMenus();
        const tMenus = await this.target.GetMenus();

        let completedCounts = 0;
        const startTime = Date.now();

        for (const sMenu of sMenus) {
            Logger.debug(`Processing menu: ${sMenu.title}(${sMenu.handle}){${sMenu.id}}`);

            const countStartTime = Date.now();

            const tMenu = tMenus.find(menu => menu.handle === sMenu.handle);
            try {
                await this.SyncMenu(sMenu, tMenu);
            } catch (err) {
                const processHandleString = "SyncMenu";
                Logger.error(`Failed to process handle: ${processHandleString}`, err);
                Sentry.captureException(err, { tags: { section: processHandleString } });
            }
            const countElapsedTime = Date.now() - countStartTime;
            Logger.debug(`Sync completed for ${sMenu.handle} in ${(countElapsedTime / 1000).toFixed(2)} seconds.`);

            completedCounts++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerCount = elapsedTime / completedCounts;
            const remainingTime = avgTimePerCount * (sMenus.length - completedCounts);

            Logger.debug(
                `Completed ${completedCounts}/${sMenus.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }

    }

    async SyncMenu(sMenu: ShopifyMenu, tMenu: ShopifyMenu | undefined) {
        if (tMenu && !(await this.IsMenuMatch(sMenu, tMenu))) {
            const deletedMenuId = await this.target.DeleteMenu(tMenu.id);
            Logger.info(`Deleted mis-matched menu for handle: ${sMenu.handle}{${deletedMenuId}}`);
        }

        const newMenuData = {
            title: sMenu.title,
            handle: sMenu.handle,
            items: await Promise.all(sMenu.items.map(menuItem => this.ProcessMenuItem(menuItem)))
        }
        const newMenu = await this.target.CreateMenu(newMenuData)
        Logger.info(`Created new menu: ${newMenu.id}`);
    }

    async ProcessMenuItem(menuItem: ShopifyMenuItem): Promise<ShopifyMenuItemCreateInput> {
        return {
            title: menuItem.title,
            type: menuItem.type,
            resourceId: await this.GetTargetResourceIdForSourceResourceId(menuItem.resourceId),
            url: menuItem.url,
            tags: menuItem.tags,
            items: menuItem.items && menuItem.items.length ? await Promise.all(menuItem.items.map(subItem => this.ProcessMenuItem(subItem))) : []
        }
    }

    async GetTargetResourceIdForSourceResourceId(sResourceId: string | undefined) {
        if (!sResourceId) return null;
        switch (PageService.GetResourceTypeFromID(sResourceId)) {
            case "Page":
                const sPage = this.sPages.find(pg => pg.id === sResourceId);
                if (!sPage) throw new PageServiceError(`Page not found at source with id: ${sResourceId}`)
                const tPage = this.tPages.find(pg => pg.handle === sPage.handle);
                if (!tPage) {
                    Logger.warn(`Page not found at target with handle: ${sPage.handle}`);
                    return null;
                }
                return tPage.id;
            case "CustomerAccountPage":
                const sCustomerAccountPage = this.sCustomerAccountPages.find(pg => pg.id === sResourceId);
                if (!sCustomerAccountPage) throw new PageServiceError(`CustomerAccountPage not found at source with id: ${sResourceId}`)
                const tCustomerAccountPage = this.tCustomerAccountPages.find(pg => pg.handle === sCustomerAccountPage.handle);
                if (!tCustomerAccountPage) {
                    Logger.warn(`CustomerAccountPage not found at target with handle: ${sCustomerAccountPage.handle}`);
                    return null;
                }
                return tCustomerAccountPage.id;
            case "Collection":
                const sMenuItemCollection = await this.collectionService.GetSourceCollectionById(sResourceId);
                const tMenuItemCollection = await this.collectionService.GetTargetCollectionByHandle(sMenuItemCollection.handle);
                return tMenuItemCollection.id;
            case "Product":
                const sMenuItemProduct = await this.source.GetProduct(sResourceId);
                if (!sMenuItemProduct) throw new PageServiceError(`Product not found at source with id: ${sResourceId}`)
                const tMenuItemProduct = await this.target.GetProductByHandle(sMenuItemProduct.handle);
                if (!tMenuItemProduct) {
                    Logger.warn(`Product not found at target with handle: ${sMenuItemProduct.handle}`);
                    return null;
                }
                return tMenuItemProduct.id;
            default: throw new PageServiceError(`Resource type not supported for id: ${sResourceId}`);
        }
    }
}