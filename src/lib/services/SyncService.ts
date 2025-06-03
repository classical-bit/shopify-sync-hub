import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { MetafieldService } from "./MetafieldService";
import { ProductService } from "./ProductService";
import { MetaobjectDefinitionService } from "./MetaobjectDefinitionService";

import { PageService } from "./PageService";
import { Logger } from "../utils/Logger";
import { MetaobjectService } from "./MetaobjectService";
import { MetafieldDefinitionService } from "./MetafieldDefinitionService";
import { FileService } from "./FileService";
import { CollectionService } from "./CollectionService";

export class SyncServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SyncServiceError";
    }
}
export class SyncService {
    source
    target
    fileService
    metaobjectService
    metafieldService
    metaobjectDefService
    metafieldDefService
    collectionService
    productService
    pageService

    constructor() {
        const sourceShopName = process.env.SOURCE_SHOPIFY_STORE_NAME;
        const sourceAccessToken = process.env.SOURCE_SHOPIFY_ACCESS_TOKEN;
        const targetShopName = process.env.TARGET_SHOPIFY_STORE_NAME;
        const targetAccessToken = process.env.TARGET_SHOPIFY_ACCESS_TOKEN;

        if (!sourceShopName || !sourceAccessToken) {
            throw new SyncServiceError('Source Shopify creds are not set in env.');
        }

        if (!targetShopName || !targetAccessToken) {
            throw new SyncServiceError('Target Shopify creds are not set in env.');
        }

        Logger.info(`Source: ${sourceShopName} --> Target: ${targetShopName}`);
        this.source = new ShopifyConnection({ shopName: sourceShopName, accessToken: sourceAccessToken });
        this.target = new ShopifyConnection({ shopName: targetShopName, accessToken: targetAccessToken });
        this.metaobjectService = new MetaobjectService(this.source, this.target);
        this.metafieldService = new MetafieldService(this.source, this.target);
        this.metaobjectDefService = new MetaobjectDefinitionService(this.source, this.target);
        this.metafieldDefService = new MetafieldDefinitionService(this.source, this.target);
        this.collectionService = new CollectionService(this.source, this.target);
        this.productService = new ProductService(this.source, this.target);
        this.pageService = new PageService(this.source, this.target);
        this.fileService = new FileService(this.source, this.target);
    }
}
