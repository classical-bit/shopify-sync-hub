import { ShopifyMetafield } from "../shopify/schemas/metafield/ShopifyMetafield";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import { MetaobjectService } from "./MetaobjectService";

export class MetafieldServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MetafieldServiceError";
    }
}

export class MetafieldService {
    private metaobjectService;
    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
        this.metaobjectService = new MetaobjectService(this.source, this.target);
    }

    private async IsMetafieldMatch(sMetafield: ShopifyMetafield, tMetafield: ShopifyMetafield): Promise<boolean> {
        return await this.metaobjectService.IsFieldMatch(sMetafield, tMetafield);
    }

    async SyncMetafield(ownerId: string, sMetafield: ShopifyMetafield, tMetafield: ShopifyMetafield | undefined): Promise<ShopifyMetafield | null> {
        Logger.debug(`Sync metafield: ${sMetafield.namespace}:${sMetafield.key}(${sMetafield.type}) ownerId: ${ownerId}`);
        if (sMetafield.namespace === "global" && sMetafield.key === "harmonized_system_code") {
            Logger.debug("Setting Harmonized system code ('harmonized_system_code') as metafield on Product Variant is no longer supported. Update 'harmonized_system_code' on inventory item instead.");
            Logger.debug(`Not Synced target metafield: ${sMetafield.namespace}:${sMetafield.key}(${sMetafield.type})`);
            return null;
        }

        if (tMetafield) {
            if (await this.IsMetafieldMatch(sMetafield, tMetafield)) {
                Logger.debug(`Existing Metafield match: ${tMetafield.namespace}:${tMetafield.key}{${tMetafield.id}}`);
                return tMetafield;
            }

            Logger.debug(`Existing Metafield mis-match: ${sMetafield.namespace}:${sMetafield.key}{${sMetafield.id}}`);
            const deletedMetafield = await this.target.DeleteMetafields([{ ...tMetafield, ownerId }]);
            Logger.info(`Deleted mis-matched Metafield: ${tMetafield.namespace}:${tMetafield.key} ${deletedMetafield}`);
        }

        const tMetafieldValue = await this.metaobjectService.GetTargetFieldValueForSourceField(sMetafield);
        if (tMetafieldValue == null) {
            Logger.info(`Not Synced target Metafield: ${sMetafield.namespace}:${sMetafield.key}(${sMetafield.type})`);
            return null;
        }

        const updatedTMetafield = (await this.target.SetMetafields([{
            ownerId,
            namespace: sMetafield.namespace,
            key: sMetafield.key,
            type: sMetafield.type,
            value: tMetafieldValue
        }])).pop();

        if (updatedTMetafield) {
            Logger.info(`Updated target metafield: ${updatedTMetafield.namespace}:${updatedTMetafield.key}(${updatedTMetafield.type}){${updatedTMetafield.id}}`);
            return updatedTMetafield;
        }
        else {
            Logger.info(`Not Synced target metafield: ${sMetafield.namespace}:${sMetafield.key}(${sMetafield.type})`);
            return null;
        }
    }

    async DeleteMetafieldsOfOwners(ownerTypes: string[]) {
        Logger.debug(`Delete metafield definition entries of owner: ${ownerTypes.join()}`);
        const sMetafieldDefs = (await Promise.all(ownerTypes.map(ownerType => this.source.GetMetafieldDefinitions(ownerType)))).flatMap(mfdefs => mfdefs);
        for await (const tProducts of this.target.GetProducts()) {
            const tMetafields = [
                ...tProducts.flatMap((tProduct) => tProduct.metafields.map(mf => ({ ownerId: tProduct.id, ...mf }))),
                ...tProducts.flatMap((tProduct) => tProduct.variants.flatMap((variant) =>
                    variant.metafields.map(mf => ({ ownerId: variant.id, ...mf }))))
            ].filter(mf => sMetafieldDefs.find(smf => smf.namespace === mf.namespace && smf.key === mf.key))
            Logger.debug(`Metafields to delete: ${tMetafields.length}`);

            await this.target.DeleteMetafields(tMetafields.map(mf => ({
                ownerId: mf.ownerId,
                namespace: mf.namespace,
                key: mf.key
            })));
        }
    }
}