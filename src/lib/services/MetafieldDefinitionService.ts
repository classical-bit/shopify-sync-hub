import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import { ShopifyMetaobjectDefinition } from "../shopify/schemas/metaobject/ShopifyMetaobjectDefinition";
import Sentry from "../utils/Sentry";
import { MetafieldDefinitionModel } from "../shopify/models/MetafieldDefinitionModel";
import { ShopifyMetafieldDefinition } from "../shopify/schemas/metafield/ShopifyMetafieldDefinition";
import { ShopifyMetafieldDefinitionUpdateInput } from "../shopify/schemas/metafield/ShopifyMetafieldDefinitionUpdateInput";

export class MetafieldDefinitionServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MetafieldDefinitionServiceError";
    }
}

export class MetafieldDefinitionService {
    sMetaobjectDefs: ShopifyMetaobjectDefinition[] = [];
    tMetaobjectDefs: ShopifyMetaobjectDefinition[] = [];
    initialized = false;
    ownerTypes = ["PAGE", "PRODUCT", "PRODUCTVARIANT"];

    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
    }

    async init() {
        this.sMetaobjectDefs = await this.source.GetMetaobjectDefinitions();
        this.tMetaobjectDefs = await this.target.GetMetaobjectDefinitions();
        this.initialized = true;
    }

    async requireInit() {
        if (!this.initialized) {
            await this.init();
        }
    }

    async GetPartialUpdatedMetafieldDefinition(sMetafieldDef: ShopifyMetafieldDefinition, tMetafieldDef: ShopifyMetafieldDefinition): Promise<ShopifyMetafieldDefinitionUpdateInput | undefined> {
        const updateMetafieldDef: ShopifyMetafieldDefinitionUpdateInput = { namespace: sMetafieldDef.namespace, key: sMetafieldDef.key };
        if (tMetafieldDef.name !== sMetafieldDef.name) {
            Logger.info("Name mis-match!");
            updateMetafieldDef.name = sMetafieldDef.name;
        }

        if (tMetafieldDef.ownerType !== sMetafieldDef.ownerType) {
            Logger.info("OwnerType mis-match!");
            updateMetafieldDef.ownerType = sMetafieldDef.ownerType;
        }

        if (tMetafieldDef.access && (tMetafieldDef.access.storefront !== sMetafieldDef.access.storefront)) {
            Logger.info("Access storefront mis-match!");
            if (updateMetafieldDef.access) {
                updateMetafieldDef.access.storefront = sMetafieldDef.access.storefront;
            } else {
                updateMetafieldDef.access = { storefront: sMetafieldDef.access.storefront };
            }
        }

        if (tMetafieldDef.access && (tMetafieldDef.access.customerAccount !== sMetafieldDef.access.customerAccount)) {
            Logger.info("Access customerAccount mis-match!");
            if (updateMetafieldDef.access) {
                updateMetafieldDef.access.customerAccount = sMetafieldDef.access.customerAccount;
            } else {
                updateMetafieldDef.access = { customerAccount: sMetafieldDef.access.customerAccount };
            }
        }

        const updatedValidations = [];
        for (const sMetafieldDefValidation of sMetafieldDef.validations) {
            const tMetafieldDefValidation = tMetafieldDef.validations.find(v => v.name === sMetafieldDefValidation.name);

            if (sMetafieldDefValidation.name === "metaobject_definition_id") {
                const sMetaobjectDef = this.sMetaobjectDefs.find(def => def.id === sMetafieldDefValidation.value);
                if (!sMetaobjectDef) {
                    throw new MetafieldDefinitionServiceError(`Failed! Sync Metafield Defintion: source not found Metaobject Definition: ${sMetafieldDefValidation.value}`);
                }
                const tMetaobjectDef = this.tMetaobjectDefs.find(def => def.type === sMetaobjectDef.type);
                if (!tMetaobjectDef) {
                    throw new MetafieldDefinitionServiceError(`Failed! Sync Metafield Defintion: target not found Metaobject Definition: ${sMetaobjectDef.type}`);
                }

                if (!tMetafieldDefValidation || tMetafieldDefValidation.value !== tMetaobjectDef.id) {
                    Logger.info(`Metafield definition: ${sMetafieldDef.namespace}:${sMetafieldDef.key} validation missing/mis-match!`);
                    updatedValidations.push({
                        name: sMetafieldDefValidation.name,
                        value: tMetaobjectDef.id,
                    });
                }
            } else {
                if (!tMetafieldDefValidation || tMetafieldDefValidation.value !== sMetafieldDefValidation.value) {
                    Logger.info(`Field definition: ${sMetafieldDef.namespace}:${sMetafieldDef.key} validation missing/mis-match!`);
                    updatedValidations.push({
                        name: sMetafieldDefValidation.name,
                        value: sMetafieldDefValidation.value,
                    });
                }
            }
        }
        if (updatedValidations.length) updateMetafieldDef.validations = updatedValidations;

        if (Object.keys(updateMetafieldDef).length > 2) return updateMetafieldDef;
        return undefined;
    }

    async SyncMetafieldDefinition(sMetafieldDef: ShopifyMetafieldDefinition, tMetafieldDef: ShopifyMetafieldDefinition | undefined) {
        if (tMetafieldDef) {
            const partialUpdatedMetafieldDef = await this.GetPartialUpdatedMetafieldDefinition(sMetafieldDef, tMetafieldDef);
            if (partialUpdatedMetafieldDef) {
                Logger.debug(`Metafield Definition mis-matched --> name: ${sMetafieldDef.name}, type: ${sMetafieldDef.type}`);
                const updatedTMetafieldDef = await this.target.UpdateMetafieldDefinition(partialUpdatedMetafieldDef);
                Logger.info(`Updated target mis-matched Metafield Definition --> name: ${sMetafieldDef.name}, type: ${sMetafieldDef.type}, tid: ${updatedTMetafieldDef.id}`);
                return updatedTMetafieldDef;
            }

            Logger.debug(`Metafield Definition matched --> name: ${sMetafieldDef.name}, type: ${sMetafieldDef.type}`);
            return tMetafieldDef;
        }

        const newTMetafieldDefData = {
            name: sMetafieldDef.name,
            namespace: sMetafieldDef.namespace,
            key: sMetafieldDef.key,
            ownerType: sMetafieldDef.ownerType,
            type: sMetafieldDef.type.name,
            pin: !!sMetafieldDef.pinnedPosition,
            access: {
                storefront: sMetafieldDef.access.storefront
            },
            validations: sMetafieldDef.validations.map(validation => {
                if (validation.name === "metaobject_definition_id") {
                    const sMetaobjectDef = this.sMetaobjectDefs.find(def => def.id === validation.value);
                    if (!sMetaobjectDef) {
                        throw new MetafieldDefinitionServiceError(`Failed! Sync Metafield Defintion: source not found Metaobject Definition: ${validation.value}`);
                    }
                    const tMetaobjectDef = this.tMetaobjectDefs.find(def => def.type === sMetaobjectDef.type);
                    if (!tMetaobjectDef) {
                        throw new MetafieldDefinitionServiceError(`Failed! Sync Metafield Defintion: target not found Metaobject Definition: ${sMetaobjectDef.type}`);
                    }
                    return {
                        name: validation.name,
                        value: tMetaobjectDef.id
                    }
                }
                return {
                    name: validation.name,
                    value: validation.value
                }
            })
        };

        const newTMetafieldDef = await this.target.CreateMetafieldDefinition(newTMetafieldDefData);
        Logger.debug(`Created Metafield Definition at target: ${newTMetafieldDef.name}-${newTMetafieldDef.ownerType}(${newTMetafieldDef.key}:${newTMetafieldDef.namespace}){${newTMetafieldDef.id}}`);

    }

    async SyncMetafieldDefinitions() {
        await this.requireInit();

        Logger.debug(`Sync Metafield Definitions of owner: ${this.ownerTypes.join()}`);
        const sMetafieldDefs = (await Promise.all(this.ownerTypes.map(ownerType => this.source.GetMetafieldDefinitions(ownerType)))).flatMap(mfdefs => mfdefs);
        const tMetafieldDefs = (await Promise.all(this.ownerTypes.map(ownerType => this.target.GetMetafieldDefinitions(ownerType)))).flatMap(mfdefs => mfdefs);

        let completedCounts = 0;
        const startTime = Date.now();

        const sMetafieldsToProcess = sMetafieldDefs.filter(mf => !mf.namespace.includes("shopify"));

        for (const sMetafieldDef of sMetafieldsToProcess) {
            const countStartTime = Date.now();

            if (sMetafieldDef.namespace.includes("shopify")) continue;
            Logger.debug(`Reading Metafield Definition: ${sMetafieldDef.name}-${sMetafieldDef.ownerType}(${sMetafieldDef.key}:${sMetafieldDef.namespace}){${sMetafieldDef.id}}`);

            const tMetafieldtDef = tMetafieldDefs.find(def => def.key === sMetafieldDef.key && def.namespace === sMetafieldDef.namespace);
            try {
                await this.SyncMetafieldDefinition(sMetafieldDef, tMetafieldtDef)
            } catch (err) {
                const processHandleString = "MetafieldDefService.SyncMetafieldDefinitionsOfOwners";
                Logger.error(`Failed to process handle: ${processHandleString}`, err);
                Sentry.captureException(err, { tags: { section: processHandleString } });
            }

            const countElapsedTime = Date.now() - countStartTime;
            Logger.debug(`Sync completed for ${sMetafieldDef.key}:${sMetafieldDef.namespace} in ${(countElapsedTime / 1000).toFixed(2)} seconds.`);

            completedCounts++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerCount = elapsedTime / completedCounts;
            const remainingTime = avgTimePerCount * (sMetafieldsToProcess.length - completedCounts);

            Logger.debug(
                `Completed ${completedCounts}/${sMetafieldsToProcess.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }

    }


    async DeleteMetafieldDefinitionsOfOwners() {
        Logger.debug(`Delete Metafield Definitions of owner: ${this.ownerTypes.join()}`);
        const sMetafieldDefs = (await Promise.all(this.ownerTypes.map(ownerType => this.source.GetMetafieldDefinitions(ownerType)))).flatMap(mfdefs => mfdefs);
        const tMetafieldDefs = (await Promise.all(this.ownerTypes.map(ownerType => this.target.GetMetafieldDefinitions(ownerType)))).flatMap(mfdefs => mfdefs);

        for (const sMetafieldDef of sMetafieldDefs) {
            if (sMetafieldDef.namespace.includes("shopify")) continue;

            const tMetafieldDef = tMetafieldDefs.find(def => def.namespace === sMetafieldDef.namespace && def.key === sMetafieldDef.key);
            if (!tMetafieldDef) {
                Logger.debug(`Not found Metafield Definition: ${sMetafieldDef.namespace}:${sMetafieldDef.key}`);
                continue;
            }
            const deleteId = await this.target.DeleteMetafieldDefinition(tMetafieldDef.id)
            Logger.info(`Deleted Metafield Definition: ${tMetafieldDef.namespace}:${tMetafieldDef.key}{${deleteId}}`);
        }
    }
}