import { inspect } from "util";
import { ShopifyMetaobjectDefinition } from "../shopify/schemas/metaobject/ShopifyMetaobjectDefinition";
import { ShopifyMetaobjectDefinitionCreateInput, ShopifyMetaobjectDefinitionFieldDefinitionInput } from "../shopify/schemas/metaobject/ShopifyMetaobjectDefinitionCreateInput";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import { MetaobjectService } from "./MetaobjectService";
import { isEqual } from "lodash";
import Sentry from "../utils/Sentry";
import { MetaobjectFieldDefinitionOperationInput, MetaobjectFieldDefinitionUpdateOperationInput, ShopifyMetaobjectDefinitionUpdateInput } from "../shopify/schemas/metaobject/ShopifyMetaobjectDefinitionUpdateInput";

export class MetaobjectDefinitionServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MetaobjectDefinitionServiceError";
    }
}

export class MetaobjectDefinitionService {
    sMetaobjectDefs: ShopifyMetaobjectDefinition[] = [];
    tMetaobjectDefs: ShopifyMetaobjectDefinition[] = [];
    initialized = false;
    metaobjectService;

    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
        this.metaobjectService = new MetaobjectService(this.source, this.target);
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

    async IsMetaobjectDefinitionMatch(sMetaobjectDef: ShopifyMetaobjectDefinition,
        tMetaobjectDef: ShopifyMetaobjectDefinition): Promise<boolean> {
        if (sMetaobjectDef.type !== tMetaobjectDef.type ||
            sMetaobjectDef.name !== tMetaobjectDef.name ||
            sMetaobjectDef.displayNameKey !== tMetaobjectDef.displayNameKey ||
            !isEqual(sMetaobjectDef.access, tMetaobjectDef.access)
        ) return false;

        for (const sFieldDef of sMetaobjectDef.fieldDefinitions) {
            const tFieldDef = tMetaobjectDef.fieldDefinitions.find(f => f.key === sFieldDef.key);
            if (!tFieldDef) return false;

            if (sFieldDef.description !== tFieldDef.description ||
                sFieldDef.key !== tFieldDef.key ||
                sFieldDef.name !== tFieldDef.name ||
                sFieldDef.required !== tFieldDef.required ||
                !isEqual(sFieldDef.type, tFieldDef.type)
            ) return false;

            for (const sFieldDefValidation of sFieldDef.validations) {
                const tFieldDefValidation = tFieldDef.validations.find(v => v.name === sFieldDefValidation.name && v.type === sFieldDefValidation.type);
                if (!tFieldDefValidation) return false;

                if (["metaobject_reference", "list.metaobject_reference"].includes(sFieldDefValidation.type)) {
                    const sFiedlDefMetaobjectDef = this.sMetaobjectDefs.find(def => def.id === sFieldDefValidation.value);
                    if (!sFiedlDefMetaobjectDef) {
                        throw new MetaobjectDefinitionServiceError(`Couldn't resolve source Metaobject Definition for id: ${sFieldDefValidation.value}`);
                    }
                    const tFiedlDefMetaobjectDef = await this.GetTargetMetaobjectDefinitionForSourceId(sFiedlDefMetaobjectDef);
                    if (!tFiedlDefMetaobjectDef) return false;
                } else {
                    if (sFieldDefValidation.value !== tFieldDefValidation.value) return false;
                }
            }
        }

        return true;
    }

    async GetTargetMetaobjectDefinitionForSourceId(sMetaobjectDef: ShopifyMetaobjectDefinition): Promise<ShopifyMetaobjectDefinition | undefined> {
        await this.requireInit();
        return this.tMetaobjectDefs.find(def => def.type === sMetaobjectDef.type);
    }

    async SyncMetaobjectDefinition(sMetaobjectDef: ShopifyMetaobjectDefinition,
        tMetaobjectDef: ShopifyMetaobjectDefinition | undefined)
        : Promise<ShopifyMetaobjectDefinition> {
        Logger.debug(`Sync Metaobject Definition --> name: ${sMetaobjectDef.name}, type: ${sMetaobjectDef.type}, sid: ${sMetaobjectDef.id}`);

        if (tMetaobjectDef) {
            const partialUpdatedTMetaobjectDef = await this.GetPartialUpdatedMetaobjectDefinition(sMetaobjectDef, tMetaobjectDef)
            if (partialUpdatedTMetaobjectDef) {
                Logger.debug(`Metaobject Definition mis-matched --> name: ${sMetaobjectDef.name}, type: ${sMetaobjectDef.type}`);
                const updatedTMetaobjectDef = await this.target.UpdateMetaobjectDefinition(tMetaobjectDef.id, partialUpdatedTMetaobjectDef);
                Logger.info(`Updated target mis-matched Metaobject Definition --> name: ${sMetaobjectDef.name}, type: ${sMetaobjectDef.type}, tid: ${updatedTMetaobjectDef.id}`);
                return updatedTMetaobjectDef;
            }

            Logger.debug(`Metaobject Definition matched --> name: ${sMetaobjectDef.name}, type: ${sMetaobjectDef.type}`);
            return tMetaobjectDef;
        }

        const tFieldDefs: ShopifyMetaobjectDefinitionFieldDefinitionInput[] = [];
        for (const sFieldDef of sMetaobjectDef.fieldDefinitions) {
            const tFieldDefValidations = [];
            for (const sFieldDefValidation of sFieldDef.validations) {
                if (sFieldDefValidation.name === "metaobject_definition_id") {
                    if (sFieldDefValidation.value === null) {
                        tFieldDefValidations.push({
                            name: "metaobject_definition_id",
                            value: null
                        });
                        continue;
                    }

                    const sFiedlDefMetaobjectDef = this.sMetaobjectDefs.find(def => def.id === sFieldDefValidation.value);
                    if (!sFiedlDefMetaobjectDef) {
                        throw new MetaobjectDefinitionServiceError(`Couldn't resolve source Metaobject Definition for id: ${sFieldDefValidation.value}`);
                    }
                    const tFiedlDefMetaobjectDef = await this.GetTargetMetaobjectDefinitionForSourceId(sFiedlDefMetaobjectDef);
                    const syncedTFieldDefMetaobjectDef = await this.SyncMetaobjectDefinition(sFiedlDefMetaobjectDef, tFiedlDefMetaobjectDef);
                    tFieldDefValidations.push({
                        name: "metaobject_definition_id",
                        value: syncedTFieldDefMetaobjectDef.id
                    });
                } else {
                    tFieldDefValidations.push({
                        name: sFieldDefValidation.name,
                        value: sFieldDefValidation.value
                    });
                }
            }
            tFieldDefs.push({
                description: sFieldDef.description,
                key: sFieldDef.key,
                name: sFieldDef.name,
                required: sFieldDef.required,
                type: sFieldDef.type.name,
                validations: tFieldDefValidations
            });
        }
        const newTMetaobjectDef = await this.target.CreateMetaobjectDefinition({
            name: sMetaobjectDef.name,
            type: sMetaobjectDef.type,
            displayNameKey: sMetaobjectDef.displayNameKey,
            access: { storefront: sMetaobjectDef.access.storefront },
            fieldDefinitions: tFieldDefs
        });
        this.tMetaobjectDefs.push(newTMetaobjectDef);
        Logger.info(`Synced Metaobject Definition --> name: ${sMetaobjectDef.name}, type: ${newTMetaobjectDef.type}`);

        return newTMetaobjectDef;
    }

    async SyncMetaobjectDefinitionEntries(sMetaobjectDef: ShopifyMetaobjectDefinition) {
        Logger.debug(`Sync Metaobjects Entries of Definition --> name: ${sMetaobjectDef.name}, type: ${sMetaobjectDef.type}`);
        for (const metaobject of sMetaobjectDef.metaobjects.edges.map(moedge => moedge.node)) {
            try {
                await this.metaobjectService.SyncMetaobject(metaobject.id);
            } catch (err) {
                const processHandleString = "MetaobjectService.SyncMetaobject";
                Logger.error(`Failed to process handle: ${processHandleString}`, err);
                Sentry.captureException(err, { tags: { section: processHandleString } });
            }
        }
    }

    async SyncMetaobjectDefinitions() {

        await this.requireInit();
        Logger.debug("Sync Metaobject Definitions");

        let completedCounts = 0;
        const startTime = Date.now();

        const sMetaobjectDefsToProcess = this.sMetaobjectDefs.filter(md => !md.type.includes("shopify--")).slice(7);

        for (const sMetaobjectDef of sMetaobjectDefsToProcess) {
            const countStartTime = Date.now();
            try {
                const tMetaobjectDef = this.tMetaobjectDefs.find(def => def.type === sMetaobjectDef.type);
                await this.SyncMetaobjectDefinition(sMetaobjectDef, tMetaobjectDef);
                await this.SyncMetaobjectDefinitionEntries(sMetaobjectDef);
            } catch (err) {
                const processHandleString = "MetaobjectDefService.SyncMetaobjectDefinitions";
                Logger.error(`Failed to process handle: ${processHandleString}`, err);
                Sentry.captureException(err, { tags: { section: processHandleString } });
            }

            const countElapsedTime = Date.now() - countStartTime;
            Logger.debug(`Sync completed for ${sMetaobjectDef.type} in ${(countElapsedTime / 1000).toFixed(2)} seconds.`);
            completedCounts++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerCount = elapsedTime / completedCounts;
            const remainingTime = avgTimePerCount * (sMetaobjectDefsToProcess.length - completedCounts);

            Logger.debug(
                `Completed ${completedCounts}/${sMetaobjectDefsToProcess.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }

    }

    async GetPartialUpdatedMetaobjectDefinition(sMetaobjectDef: ShopifyMetaobjectDefinition, tMetaobjectDef: ShopifyMetaobjectDefinition): Promise<ShopifyMetaobjectDefinitionUpdateInput | undefined> {
        const updateMetaobjectDef: ShopifyMetaobjectDefinitionUpdateInput = {};
        if (tMetaobjectDef.name !== sMetaobjectDef.name) {
            Logger.info("Name mis-match!");
            updateMetaobjectDef.name = sMetaobjectDef.name;
        }

        if (tMetaobjectDef.access && (tMetaobjectDef.access.storefront !== sMetaobjectDef.access.storefront)) {
            Logger.info("Access storefront mis-match!");
            if (!updateMetaobjectDef.access) {
                updateMetaobjectDef.access = { storefront: sMetaobjectDef.access.storefront };
            } else {
                updateMetaobjectDef.access.storefront = sMetaobjectDef.access.storefront;
            }
        }

        if (tMetaobjectDef.displayNameKey !== sMetaobjectDef.displayNameKey) {
            Logger.info("DisplayNameKey mis-match!");
            updateMetaobjectDef.displayNameKey = sMetaobjectDef.displayNameKey || undefined;
        }

        const updateFieldDefinitions: MetaobjectFieldDefinitionOperationInput[] = [];
        for (const sFieldDef of sMetaobjectDef.fieldDefinitions) {
            const tFieldDef = tMetaobjectDef.fieldDefinitions.find(fd => fd.key === sFieldDef.key);
            if (!tFieldDef) {
                Logger.info("Field definition missing!");
                updateFieldDefinitions.push({
                    create: {
                        key: sFieldDef.key,
                        name: sFieldDef.name,
                        description: sFieldDef.description,
                        required: sFieldDef.required,
                        type: sFieldDef.type.name,
                        validations: sFieldDef.validations
                    }
                });
                continue;
            }

            const updateFieldDef: MetaobjectFieldDefinitionUpdateOperationInput = { key: sFieldDef.key };
            if (tFieldDef.name !== sFieldDef.name) {
                Logger.info(`Field definition key: ${sFieldDef.key} name mis-match!`);
                updateFieldDef.name = sFieldDef.name;
            }
            if (tFieldDef.description !== sFieldDef.description) {
                Logger.info(`Field definition key: ${sFieldDef.key} description mis-match!`);
                updateFieldDef.description = sFieldDef.description;
            }

            if (tFieldDef.required !== sFieldDef.required) {
                Logger.info(`Field definition key: ${sFieldDef.key} required mis-match!`);
                updateFieldDef.required = sFieldDef.required;
            }

            const updatedValidations = [];
            for (const sFieldDefValidation of sFieldDef.validations) {
                const tFieldDefValidation = tFieldDef.validations.find(v => v.name === sFieldDefValidation.name);

                if (sFieldDefValidation.name === "metaobject_definition_id") {
                    const sMetaobjectDef = this.sMetaobjectDefs.find(def => def.id === sFieldDefValidation.value);
                    if (!sMetaobjectDef) {
                        throw new MetaobjectDefinitionServiceError(`Failed! Sync Metaobject Defintion: source not found Metaobject Definition: ${sFieldDefValidation.value}`);
                    }
                    const tMetaobjectDef = this.tMetaobjectDefs.find(def => def.type === sMetaobjectDef.type);
                    if (!tMetaobjectDef) {
                        throw new MetaobjectDefinitionServiceError(`Failed! Sync Metaobject Defintion: target not found Metaobject Definition: ${sMetaobjectDef.type}`);
                    }

                    if (!tFieldDefValidation || tFieldDefValidation.value !== tMetaobjectDef.id) {
                        Logger.info(`Field definition key: ${sFieldDef.key} validation missing/mis-match!`);
                        updatedValidations.push({
                            name: sFieldDefValidation.name,
                            value: tMetaobjectDef.id,
                        });
                    }
                } else {
                    if (!tFieldDefValidation || tFieldDefValidation.value !== sFieldDefValidation.value) {
                        Logger.info(`Field definition key: ${sFieldDef.key} validation missing/mis-match!`);
                        updatedValidations.push({
                            name: sFieldDefValidation.name,
                            value: sFieldDefValidation.value,
                        });
                    }
                }
            }
            if (updatedValidations.length) updateFieldDef.validations = updatedValidations;

            if (Object.keys(updateFieldDef).length > 1) updateFieldDefinitions.push({ update: updateFieldDef });
        }

        if (updateFieldDefinitions.length) updateMetaobjectDef.fieldDefinitions = updateFieldDefinitions;

        if (Object.keys(updateMetaobjectDef).length) return updateMetaobjectDef;
        return undefined;
    }

    async DeleteMetaobjectDefinition(tMetaobjectDef: ShopifyMetaobjectDefinition) {
        try {
            const deleteMetaobjectsJob = await this.target.DeleteMetaobjects(tMetaobjectDef.type);
            const deleteId = await this.target.DeleteMetaobjectDefinition(tMetaobjectDef.id)
            Logger.debug(`Created Metaobject Definition delete metaobjects job: ${tMetaobjectDef.type}{${deleteId}}(Job:${deleteMetaobjectsJob.job.id})`);
            return deleteId;
        } catch (err) {
            Logger.error(`Failed to delete metaobjects of definition.`, err);
        }
    }

    async DeleteMetaobjectDefinitions() {
        await this.requireInit();
        Logger.debug("Delete similar metaobject definitions");

        for (const sMetaobjectDef of this.sMetaobjectDefs) {
            if (sMetaobjectDef.type.includes("shopify--")) continue;

            const tMetaobjectDef = this.tMetaobjectDefs.find(def => def.type === sMetaobjectDef.type);
            if (!tMetaobjectDef) {
                Logger.debug(`Not found metaobject definition type: ${sMetaobjectDef.type}`);
                continue;
            }

            const deleteId = await this.DeleteMetaobjectDefinition(tMetaobjectDef);
            Logger.info(`Deleted metaobject definition ${tMetaobjectDef.type}{${deleteId}}`);
        }
    }
}