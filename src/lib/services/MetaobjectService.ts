import { MetaobjectModel } from "../shopify/models/MetaobjectModel";
import { ShopifyMetaobject } from "../shopify/schemas/metaobject/ShopifyMetaobject";
import { ShopifyMetaobjectCreateResponse } from "../shopify/schemas/metaobject/ShopifyMetaobjectCreateResponse";
import { ShopifyMetaobjectField } from "../shopify/schemas/metaobject/ShopifyMetaobjectField";
import { ShopifyMetaobjectFieldUpdateInput, ShopifyMetaobjectUpdateInput } from "../shopify/schemas/metaobject/ShopifyMetaobjectUpdateInput";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { Logger } from "../utils/Logger";
import { FileService } from "./FileService";

export class MetaobjectServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "MetaobjectServiceError";
    }
}

export class MetaobjectService {
    fileService
    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
        this.fileService = new FileService(source, target)
    }

    async DeleteMetaobjects(type: string) {
        await this.target.DeleteMetaobjects(type);
    }

    private async isMetaobjectMatch(sMetaobject: ShopifyMetaobject, tMetaobject: ShopifyMetaobject) {
        for (const sField of sMetaobject.fields) {
            const tField = tMetaobject.fields.find(f => f.key === sField.key);
            if (!tField) return false;
            if (sField.value === null && tField.value === null) {
                continue;
            }
            if (!(await this.IsFieldMatch(sField, tField))) return false;
        }

        return true;
    }

    async IsFieldMatch(sField: ShopifyMetaobjectField, tField: ShopifyMetaobjectField) {
        if (sField.value === null || tField.value === null)
            return sField.value === tField.value;

        switch (sField.type) {
            case "metaobject_reference":
                const sFieldMetaobject = await this.source.GetMetaobject(sField.value);
                if (!sFieldMetaobject) {
                    throw new MetaobjectServiceError(`Metaobject not found at source: ${sField.value}`);
                }
                const tFieldMetaobject = await this.target.GetMetaobjectByHandle(sFieldMetaobject.type, sFieldMetaobject.handle);
                if (!tFieldMetaobject) return false;
                return await this.isMetaobjectMatch(sFieldMetaobject, tFieldMetaobject);

            case "list.metaobject_reference":
                const sFieldMetaobjects: MetaobjectModel[] = [];
                for (const metaobjectId of JSON.parse(sField.value)) {
                    const sMetaobject = await this.source.GetMetaobject(metaobjectId);
                    if (!sMetaobject) {
                        throw new MetaobjectServiceError(`Metaobject not found at source: ${metaobjectId}`);
                    }
                    sFieldMetaobjects.push(sMetaobject);
                }
                const tFieldMetaobjects: MetaobjectModel[] = [];
                for (const sFieldMetaobject of sFieldMetaobjects) {
                    const tMetaobject = await this.target.GetMetaobjectByHandle(sFieldMetaobject.type, sFieldMetaobject.handle);
                    if (!tMetaobject) return false;
                    tFieldMetaobjects.push(tMetaobject);
                }
                for (const sFieldMetaobject of sFieldMetaobjects) {
                    const tFieldMetaobject = tFieldMetaobjects.find(mo =>
                        mo.definition.type === sFieldMetaobject.definition.type &&
                        mo.handle.includes(sFieldMetaobject.handle));
                    if (!tFieldMetaobject) return false;
                    if (!(await this.isMetaobjectMatch(sFieldMetaobject, tFieldMetaobject))) return false;
                }
                return true;

            case "file_reference":
                const sFieldFile = await this.source.GetFileById(sField.value);
                const tFieldFile = await this.target.GetFileById(tField.value);
                return FileService.IsFileMatch(sFieldFile, tFieldFile);

            case "list.file_reference":
                const sFieldFiles = [];
                for (const fileId of JSON.parse(sField.value)) {
                    sFieldFiles.push(await this.source.GetFileById(fileId));
                }
                const tFieldFiles = [];
                for (const fileId of JSON.parse(tField.value)) {
                    tFieldFiles.push(await this.target.GetFileById(fileId));
                }

                for (const sFieldFile of sFieldFiles) {
                    const tFieldFile = tFieldFiles.find(file => FileService.IsFileMatch(file, sFieldFile));
                    if (!tFieldFile) return false;
                }
                return true;
            case "product_reference":
                const sFieldProduct = await this.source.GetProductOrThrow(sField.value);
                const tFieldProduct = await this.target.GetProductOrThrow(tField.value);
                return sFieldProduct.handle === tFieldProduct.handle;

            default: return sField.value === tField.value;
        }
    }

    async GetPartialUpdatedMetaobject(sMetaobject: ShopifyMetaobject, tMetaobject: ShopifyMetaobject) {
        const metaobjectUpdateData: ShopifyMetaobjectUpdateInput = {
            handle: sMetaobject.handle
        };

        const fields: ShopifyMetaobjectFieldUpdateInput[] = [];
        for (const sField of sMetaobject.fields) {
            const tField = tMetaobject.fields.find(f => f.key === sField.key);
            const tFieldNewValue = await this.GetTargetFieldValueForSourceField(sField);

            if (tField && tField.value === tFieldNewValue)
                continue;
            fields.push({ key: sField.key, value: tFieldNewValue });
        }

        if (fields.length)
            metaobjectUpdateData.fields = fields;

        if (Object.keys(metaobjectUpdateData).length > 1) return metaobjectUpdateData;
        return undefined;
    }

    async SyncMetaobject(sMetaobjectId: string): Promise<ShopifyMetaobjectCreateResponse> {
        const sMetaobject = await this.source.GetMetaobject(sMetaobjectId);
        if (!sMetaobject) {
            throw new MetaobjectServiceError(`Metaobject not found at source: ${sMetaobjectId}`);
        }
        Logger.debug(`Sync Metaobject --> handle: ${sMetaobject.handle}, definition_type: ${sMetaobject.definition.type}, id: ${sMetaobjectId}`);

        const tMetaobject = await this.target.GetMetaobjectByHandle(sMetaobject.type, sMetaobject.handle);
        if (tMetaobject) {
            if (tMetaobject.type !== sMetaobject.type) {
                Logger.debug(`Metaobject mis-matched type --> handle: ${sMetaobject.handle}, source_definition_type: ${sMetaobject.definition.type} | target_definition_type: ${tMetaobject.definition.type} `);
                const deletedMetaobject = await this.target.DeleteMetaobject(tMetaobject.id);
                Logger.info(`Deleted Metaobject --> handle: ${sMetaobject.handle}, definition_type: ${sMetaobject.definition.type}, tid: ${deletedMetaobject}`);
            } else {
                const partialUpdatedMetaobject = await this.GetPartialUpdatedMetaobject(sMetaobject, tMetaobject);
                if (partialUpdatedMetaobject) {
                    Logger.debug(`Metaobject mis-matched --> handle: ${sMetaobject.handle}, definition_type: ${sMetaobject.definition.type}`);
                    const updatedMetaobject = await this.target.UpdateMetaobject(tMetaobject.id, partialUpdatedMetaobject);
                    Logger.info(`Updated Metaobject --> handle: ${sMetaobject.handle}, definition_type: ${sMetaobject.definition.type}, tid: ${updatedMetaobject.id}`);
                    return updatedMetaobject;
                }
            }
        }

        const tMetaobjectFields = await Promise.all(sMetaobject.fields.map(async (field) => {
            if (field.value) {
                const tFieldValue = await this.GetTargetFieldValueForSourceField(field);
                if (tFieldValue) return { key: field.key, value: tFieldValue };
            }
            return { key: field.key, value: "" };
        }));

        const newTMetaobject = await this.target.CreateMetaobject({
            handle: sMetaobject.handle,
            type: sMetaobject.definition.type,
            fields: tMetaobjectFields
        });
        Logger.info(`Created target Metaobject --> handle: ${sMetaobject.handle}, definition_type: ${sMetaobject.definition.type}, tid: ${newTMetaobject}`);
        return newTMetaobject;
    }

    async GetTargetFieldValueForSourceField(field: ShopifyMetaobjectField) {
        if (!field.value) {
            return null;
        }
        switch (field.type) {
            case "metaobject_reference":
                return (await this.SyncMetaobject(field.value)).id;

            case "list.metaobject_reference":
                return JSON.stringify((await Promise.all(JSON.parse(field.value).map(async (sFieldMetaobjectId: string) => {
                    return (await this.SyncMetaobject(sFieldMetaobjectId)).id;
                }))));

            case "file_reference":
                const tFieldFile = await this.fileService.GetTargetFileFromSource(field.value)
                return tFieldFile ? tFieldFile.id : null;

            case "list.file_reference":
                const tFieldFileIds = (await Promise.all(JSON.parse(field.value).map(async (sFieldFileId: string) => {
                    const tFieldFile = await this.fileService.GetTargetFileFromSource(sFieldFileId)
                    return tFieldFile ? tFieldFile.id : null;
                }))).filter(Boolean);
                return tFieldFileIds.length ? JSON.stringify(tFieldFileIds) : null;

            case "product_reference":
                const sFieldProduct = await this.source.GetProductOrThrow(field.value);
                const tFieldProduct = await this.target.GetProductByHandle(sFieldProduct.handle);
                return tFieldProduct ? tFieldProduct.id :
                    (Logger.warn(`Product not found at target with handle: ${sFieldProduct.handle}`), null);

            case "list.product_reference":
                const tFieldProductIds = (await Promise.all(JSON.parse(field.value).map(async (sFieldProductId: string) => {
                    const sFieldProduct = await this.source.GetProductOrThrow(sFieldProductId);
                    const tFieldProduct = await this.target.GetProductByHandle(sFieldProduct.handle);
                    return tFieldProduct ? tFieldProduct.id :
                        (Logger.warn(`Product not found at target with handle: ${sFieldProduct.handle}`), null);
                }))).filter(Boolean);
                return tFieldProductIds.length ? JSON.stringify(tFieldProductIds) : null;

            case "collection_reference":
                const sFieldCollection = await this.source.GetCollection(field.value);
                if (!sFieldCollection) {
                    throw new MetaobjectServiceError(`Collection not found at source, id: ${field.value}`);
                }
                const tFieldCollection = await this.target.GetCollectionByHandle(sFieldCollection.handle);
                if (!tFieldCollection) {
                    throw new MetaobjectServiceError(`Collection not found at target, handle: ${sFieldCollection.handle}`);
                }
                return tFieldCollection.id;

            case "list.collection_reference":
                const tFieldCollectionIds = (await Promise.all(JSON.parse(field.value).map(async (sFieldCollectionId: string) => {
                    const sFieldCollection = await this.source.GetCollection(sFieldCollectionId);
                    if (!sFieldCollection) {
                        throw new MetaobjectServiceError(`Collection not found at source, id: ${field.value}`);
                    }
                    const tFieldCollection = await this.target.GetCollectionByHandle(sFieldCollection.handle);
                    if (!tFieldCollection) {
                        throw new MetaobjectServiceError(`Collection not found at target, handle: ${sFieldCollection.handle}`);
                    }
                    return tFieldCollection.id;
                }))).filter(Boolean);
                return tFieldCollectionIds.length ? JSON.stringify(tFieldCollectionIds) : null;
            default: return field.value;
        }
    }
}