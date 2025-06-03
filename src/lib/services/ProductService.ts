import { FileModel } from "../shopify/models/FileModel";
import { ProductModel } from "../shopify/models/ProductModel";
import { ShopifyCreateMediaInput } from "../shopify/schemas/file/ShopifyCreateMediaInput";
import { ShopifyFile } from "../shopify/schemas/file/ShopifyFile";
import { ShopifyMetafield } from "../shopify/schemas/metafield/ShopifyMetafield";
import { ShopifyProduct } from "../shopify/schemas/product/ShopifyProduct";
import { ShopifyProductCreateInput } from "../shopify/schemas/product/ShopifyProductCreateInput";
import { ShopifyProductUpdateInput } from "../shopify/schemas/product/ShopifyProductUpdateInput";
import { ShopifyProductVariant } from "../shopify/schemas/product/ShopifyProductVariant";
import { ShopifyProductVariantsBulkInput } from "../shopify/schemas/product/ShopifyProductVariantsBulkInput";
import { ShopifyConnection } from "../shopify/ShopifyConnection";
import { CustomFileReader } from "../utils/FileReader";
import { Logger } from "../utils/Logger";
import Sentry from "../utils/Sentry";
import { CollectionService } from "./CollectionService";
import { FileService } from "./FileService";
import { MetafieldService } from "./MetafieldService";

export class ProductServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProductServiceError";
    }
}

export class ProductService {
    metafieldService
    collectionService
    fileService
    constructor(private source: ShopifyConnection, private target: ShopifyConnection) {
        this.source = source;
        this.target = target;
        this.metafieldService = new MetafieldService(this.source, this.target);
        this.collectionService = new CollectionService(this.source, this.target);
        this.fileService = new FileService(this.source, this.target);
    }

    async SyncProducts() {
        const productHandles = await CustomFileReader.GetProductHandles();
        let completedProducts = 0;

        const startTime = Date.now();
        for (const productHandle of productHandles) {
            const productStartTime = Date.now();
            try {
                const sProduct = await this.source.GetProductByHandleOrThrow(productHandle);
                const tProduct = await this.target.GetProductByHandle(productHandle);
                await this.SyncProduct(sProduct, tProduct);
            } catch (err) {
                Logger.error(`Failed while sync product, handle: ${productHandle}`, err);
                Sentry.captureException(err);
            }

            const productElapsedTime = Date.now() - productStartTime;
            Logger.debug(`Sync completed for ${productHandle} in ${(productElapsedTime / 1000).toFixed(2)} seconds.`);

            completedProducts++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerProduct = elapsedTime / completedProducts;
            const remainingTime = avgTimePerProduct * (productHandles.length - completedProducts);

            Logger.debug(
                `Completed ${completedProducts}/${productHandles.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }
    }

    async SyncProduct(sProduct: ProductModel, tProduct: ProductModel | undefined) {
        if (tProduct) {
            let updatedProduct, updatedProductVariants = undefined;

            Logger.debug("Check product for updates...");
            const partialUpdatedProduct = await this.GetPartialUpdatedProduct(sProduct, tProduct);
            if (partialUpdatedProduct) {
                Logger.debug("Target product mis-matched...");
                updatedProduct = await this.target.UpdateProduct(partialUpdatedProduct)
                Logger.info(`Updated product: ${updatedProduct.id}`);
            }

            Logger.debug("Check product variants for updates...");
            const partialUpdatedProductVariants = await this.GetPartialUpdatedProductVariants(sProduct, tProduct);
            if (partialUpdatedProductVariants) {
                Logger.debug("Target product variants mis-matched...");
                const variantsToCreate = partialUpdatedProductVariants.filter(v => !v.id);
                const variantsToUpdate = partialUpdatedProductVariants.filter(v => v.id);

                const bulkCreatedVariants = tProduct.variants.length < 100 ?
                    await this.target.BulkCreateProductVariants(tProduct.id, variantsToCreate) :
                    [];
                updatedProductVariants = [
                    ...(bulkCreatedVariants),
                    ...(await this.target.BulkUpdateProductVariants(tProduct.id, variantsToUpdate))
                ]
                Logger.info(`Updated product variants`);
            }

            if (partialUpdatedProduct || partialUpdatedProductVariants) {
                return [updatedProduct, updatedProductVariants];
            }

            Logger.debug("Target product in-sync...");
            return [tProduct];
        }

        Logger.debug("Product not found...");
        const [newProuct, newProductVariants] = await this.CreateProductMethodTwoSteps(sProduct);
        Logger.info(`Created new product at target, tid: ${newProuct.id}`);

        return [newProuct, newProductVariants];
    }

    async CreateProductMethodTwoSteps(sProduct: ProductModel) {
        const newProductData: ShopifyProductCreateInput = {
            handle: sProduct.handle,
            descriptionHtml: sProduct.descriptionHtml,
            giftCard: sProduct.isGiftCard,
            category: sProduct.category?.id,
            collectionsToJoin: await Promise.all(sProduct.collections.map(coll =>
                this.collectionService.GetTargetCollectionFromSource(coll.id).then(c => c.id))),
            combinedListingRole: sProduct.combinedListingRole || undefined,
            giftCardTemplateSuffix: sProduct.giftCardTemplateSuffix,
            productOptions: sProduct.options.map(option => ({ name: option.name, position: option.position, values: option.optionValues })),
            productType: sProduct.productType,
            requiresSellingPlan: sProduct.requiresSellingPlan,
            seo: sProduct.seo,
            status: sProduct.status,
            tags: sProduct.tags,
            templateSuffix: sProduct.templateSuffix,
            title: sProduct.title,
            vendor: sProduct.vendor,
        };

        const productMedia = await this.GetTargetProductMediaForSource(sProduct);;

        const newProduct = await this.target.CreateProduct(newProductData, productMedia);

        const productVariants: ShopifyProductVariantsBulkInput[] = (await Promise.all(sProduct.variants.map(async sVariant => {
            const variantMediaResponse = await this.GetTargetProductVariantMediaForSourceVariant(sVariant);
            return ({
                barcode: sVariant.barcode,
                compareAtPrice: sVariant.compareAtPrice,
                inventoryItem: {
                    sku: sVariant.inventoryItem.sku,
                    tracked: sVariant.inventoryItem.tracked,
                    cost: sVariant.inventoryItem.unitCost?.amount,
                    countryCodeOfOrigin: sVariant.inventoryItem.countryCodeOfOrigin,
                    countryHarmonizedSystemCodes: sVariant.inventoryItem.countryHarmonizedSystemCodes.nodes,
                    harmonizedSystemCode: sVariant.inventoryItem.harmonizedSystemCode,
                    measurement: sVariant.inventoryItem.measurement,
                    provinceCodeOfOrigin: sVariant.inventoryItem.provinceCodeOfOrigin,
                    requiresShipping: sVariant.inventoryItem.requiresShipping
                },
                inventoryPolicy: sVariant.inventoryPolicy,
                // inventoryQuantities: [{
                //     locationId: "",
                //     availableQuantity: sVariant.inventoryQuantity
                // }],
                mediaId: variantMediaResponse.image?.id,
                // mediaSrc: variantMediaResponse.media.map(image => image.id),
                optionValues: sVariant.selectedOptions.map(selectedOption => ({ name: selectedOption.value, optionName: selectedOption.name })),
                price: sVariant.price,
                requiresComponents: sVariant.requiresComponents,
                taxable: sVariant.taxable,
                taxCode: sVariant.taxCode,
            })
        })));
        const newProductVariants = await this.target.BulkCreateProductVariants(newProduct.id, productVariants);
        return [newProduct, newProductVariants];
    }

    async GetTargetProductVariantMediaForSourceVariant(sVariant: ShopifyProductVariant): Promise<{ media: ShopifyFile[], image: ShopifyFile | null }> {
        const media: ShopifyFile[] = [];
        for (const image of sVariant.media) {
            const newMedia = await this.fileService.GetTargetFileFromSource(image.id);
            if (newMedia) media.push(newMedia);
            else Logger.warn(`Product variant(${sVariant.title}) missing image: ${image.id}`);
        }
        const image = sVariant.image ? await this.fileService.GetTargetFileFromSourceByName(FileModel.GetNameFromImageURL(sVariant.image.url)) : null;
        return { media, image };
    }

    async GetTargetProductMediaForSource(sProduct: ProductModel): Promise<ShopifyCreateMediaInput[]> {
        const media: ShopifyCreateMediaInput[] = [];
        for (const image of sProduct.media) {
            const newMedia = await this.fileService.GetTargetFileFromSource(image.id);
            if (newMedia?.preview?.image?.url) media.push({
                alt: image.alt,
                mediaContentType: image.mediaContentType,
                originalSource: newMedia.preview.image.url
            });
            else Logger.warn(`Product missing image: ${image.id}`);
        }

        return media;
    }

    async GetPartialUpdatedProduct(sProduct: ProductModel, tProduct: ProductModel): Promise<ShopifyProductUpdateInput | undefined> {
        for (const sProductMedia of sProduct.media) {
            const tProductMedia = tProduct.media.find(productMedia => productMedia.GetName() === sProductMedia.GetName());
            if (!tProductMedia) {
                Logger.warn(`Not found product(${sProduct.handle}) media for name: ${sProductMedia.GetName()}`);
            }
        }

        for (const sProductVariant of sProduct.variants) {
            const tProductVariant = tProduct.variants.find(productVariant => productVariant.title === sProductVariant.title);
            if (!tProductVariant) {
                Logger.warn(`Not found product(${sProduct.handle}) variant for title: ${sProductVariant.title}`);
                continue;
            }

            for (const sProductVariantMetafield of sProductVariant.metafields) {
                const tProductVariantMetafield = tProductVariant.metafields.find(productVariantMetafield =>
                    productVariantMetafield.namespace === sProductVariantMetafield.namespace && productVariantMetafield.key === sProductVariantMetafield.key);
                if (!tProductVariantMetafield) {
                    Logger.warn(`Not found product(${sProduct.handle}) variant(${sProductVariant.title}) metafield: ${sProductVariantMetafield.namespace}:${sProductVariantMetafield.key}`);
                    continue;
                }
            }
        }

        for (const sProductMetafield of sProduct.metafields) {
            const tProductMetafield = tProduct.metafields.find(productMetafield =>
                productMetafield.namespace === sProductMetafield.namespace && productMetafield.key === sProductMetafield.key
            );
            if (!tProductMetafield) {
                Logger.warn(`Not found product(${sProduct.handle}) metafield: ${sProductMetafield.namespace}:${sProductMetafield.key}`);
            }
        }

        const productUpdateData: ShopifyProductUpdateInput = {
            id: tProduct.id
        };

        if (sProduct.category?.id !== tProduct.category?.id) {
            Logger.info("Category mis-match!");
            productUpdateData.category = sProduct.category?.id ?? null;
        }

        if (sProduct.title !== tProduct.title) {
            Logger.info("Title mis-match!");
            productUpdateData.title = sProduct.title;
        }

        if (sProduct.descriptionHtml !== tProduct.descriptionHtml) {
            Logger.info("Discription Html mis-match!");
            productUpdateData.descriptionHtml = sProduct.descriptionHtml;
        }

        const equivalentTProductCollectionIds = await Promise.all(sProduct.collections.map(collection =>
            this.collectionService.GetTargetCollectionFromSource(collection.id).then(collection => collection.id)))
        const tProductCollectionIds = tProduct.collections.map(collection => collection.id);

        const collectionIdsToAdd = equivalentTProductCollectionIds.filter(collectionId => !tProductCollectionIds.includes(collectionId));
        if (collectionIdsToAdd.length) {
            Logger.info(`Collection(add:${collectionIdsToAdd.join()}) mis-match!`);
            productUpdateData.collectionsToJoin = collectionIdsToAdd;
        }
        const collectionIdsToRemove = tProductCollectionIds.filter(collectionId => !equivalentTProductCollectionIds.includes(collectionId));
        if (collectionIdsToRemove.length) {
            Logger.info(`Collection(remove:${collectionIdsToRemove.join()}) mis-match!`);
            productUpdateData.collectionsToLeave = collectionIdsToRemove;
        }

        if (sProduct.productType !== tProduct.productType) {
            Logger.info("Product Type mis-match!");
            productUpdateData.productType = sProduct.productType;
        }

        if (sProduct.requiresSellingPlan !== tProduct.requiresSellingPlan) {
            Logger.info("Requires Selling Plan mis-match!");
            productUpdateData.requiresSellingPlan = sProduct.requiresSellingPlan;
        }

        if (sProduct.seo.description !== tProduct.seo.description || sProduct.seo.title !== tProduct.seo.title) {
            Logger.info("SEO mis-match!");
            productUpdateData.seo = sProduct.seo;
        }

        if (sProduct.status !== tProduct.status) {
            Logger.info("Status mis-match!");
            productUpdateData.status = sProduct.status;
        }

        for (const sTag of sProduct.tags) {
            const tTag = tProduct.tags.find(tag => tag === sTag);
            if (!tTag) {
                Logger.info(`Tag(${sTag}) mis-match!`);
                productUpdateData.tags = sProduct.tags;
                continue;
            }
        }

        if (sProduct.templateSuffix !== tProduct.templateSuffix) {
            Logger.info("Template Suffix mis-match!");
            productUpdateData.templateSuffix = sProduct.templateSuffix;
        }

        if (sProduct.giftCardTemplateSuffix !== tProduct.giftCardTemplateSuffix) {
            Logger.info("GiftCard Template Suffix mis-match!");
            productUpdateData.giftCardTemplateSuffix = sProduct.giftCardTemplateSuffix;
        }

        if (sProduct.vendor !== tProduct.vendor) {
            Logger.info("Vendor mis-match!");
            productUpdateData.vendor = sProduct.vendor;
        }

        if (Object.keys(productUpdateData).length < 2) return undefined;
        return productUpdateData;
    }

    async GetPartialUpdatedProductVariants(sProduct: ProductModel, tProduct: ProductModel): Promise<ShopifyProductVariantsBulkInput[] | undefined> {
        const productVariantsUpdateData: ShopifyProductVariantsBulkInput[] = [];
        for (const sProductVariant of sProduct.variants) {
            const tProductVariant = tProduct.variants.find(productVariant => productVariant.title === sProductVariant.title);
            if (!tProductVariant) {
                const variantMediaResponse = await this.GetTargetProductVariantMediaForSourceVariant(sProductVariant);
                productVariantsUpdateData.push({
                    barcode: sProductVariant.barcode,
                    compareAtPrice: sProductVariant.compareAtPrice,
                    inventoryItem: {
                        sku: sProductVariant.inventoryItem.sku,
                        tracked: sProductVariant.inventoryItem.tracked,
                        cost: sProductVariant.inventoryItem.unitCost?.amount,
                        countryCodeOfOrigin: sProductVariant.inventoryItem.countryCodeOfOrigin,
                        countryHarmonizedSystemCodes: sProductVariant.inventoryItem.countryHarmonizedSystemCodes.nodes,
                        harmonizedSystemCode: sProductVariant.inventoryItem.harmonizedSystemCode,
                        measurement: sProductVariant.inventoryItem.measurement,
                        provinceCodeOfOrigin: sProductVariant.inventoryItem.provinceCodeOfOrigin,
                        requiresShipping: sProductVariant.inventoryItem.requiresShipping
                    },
                    inventoryPolicy: sProductVariant.inventoryPolicy,
                    // inventoryQuantities: [{
                    //     locationId: "",
                    //     availableQuantity: sProductVariant.inventoryQuantity
                    // }],
                    mediaId: variantMediaResponse.image?.id,
                    // mediaSrc: variantMediaResponse.media.map(image => image.id),
                    optionValues: sProductVariant.selectedOptions.map(selectedOption => ({ name: selectedOption.value, optionName: selectedOption.name })),
                    price: sProductVariant.price,
                    requiresComponents: sProductVariant.requiresComponents,
                    taxable: sProductVariant.taxable,
                    taxCode: sProductVariant.taxCode,
                    // metafields: sProductVariant.metafields.map(m => ({ key: m.key, namespace: m.namespace, type: m.type, value: m.value }))
                    //     .filter(m => !(m.namespace === "global" && m.key === "harmonized_system_code"))
                })
                continue;
            }

            const productVariantUpdateData: ShopifyProductVariantsBulkInput = {
                id: tProductVariant.id
            };

            if (sProductVariant.barcode !== tProductVariant.barcode) {
                productVariantUpdateData.barcode = sProductVariant.barcode;
            }

            if (sProductVariant.compareAtPrice !== tProductVariant.compareAtPrice) {
                productVariantUpdateData.barcode = sProductVariant.barcode;
            }

            if (sProductVariant.inventoryPolicy !== tProductVariant.inventoryPolicy) {
                productVariantUpdateData.inventoryPolicy = sProductVariant.inventoryPolicy;
            }

            // if (sProductVariant.inventoryQuantities !== tProductVariant.inventoryQuantities) {
            //     productVariantUpdateData.inventoryQuantities = sProductVariant.inventoryQuantities;
            // }

            // if (sProductVariant.inventoryItem !== tProductVariant.inventoryItem) {
            //     productVariantUpdateData.inventoryItem = sProductVariant.inventoryItem;
            // }

            // if (sProductVariant.optionValues !== tProductVariant.optionValues) {
            //     productVariantUpdateData.optionValues = sProductVariant.optionValues;
            // }

            if (sProductVariant.price !== tProductVariant.price) {
                productVariantUpdateData.price = sProductVariant.price;
            }

            if (sProductVariant.taxable !== tProductVariant.taxable) {
                productVariantUpdateData.taxable = sProductVariant.taxable;
            }

            if (sProductVariant.taxCode !== tProductVariant.taxCode) {
                productVariantUpdateData.taxCode = sProductVariant.taxCode;
            }

            if (sProductVariant.requiresComponents !== tProductVariant.requiresComponents) {
                productVariantUpdateData.requiresComponents = sProductVariant.requiresComponents;
            }

            // if (sProductVariant.mediaId !== tProductVariant.mediaId) {
            //     productVariantUpdateData.mediaId = sProductVariant.mediaId;
            // }

            // productVariantUpdateData.metafields = sProductVariant.metafields.filter(sProductVariantMetafield => {
            //     const tProductVariantMetafield = tProductVariant.metafields.find(productVariantMetafield =>
            //         productVariantMetafield.namespace === sProductVariantMetafield.namespace && productVariantMetafield.key === sProductVariantMetafield.key);
            //     if (!tProductVariantMetafield) {
            //         return true;
            //     } else if (sProductVariantMetafield.value !== tProductVariantMetafield.value) {
            //         return true;
            //     }
            // }).map(m => ({ key: m.key, namespace: m.namespace, type: m.type, value: m.value }))
            //     .filter(m => !(m.namespace === "global" && m.key === "harmonized_system_code"));

            if (Object.keys(productVariantUpdateData).length > 1) productVariantsUpdateData.push(productVariantUpdateData);
        }

        if (!productVariantsUpdateData.length) return undefined;
        return productVariantsUpdateData;
    }

    async SyncProductsMetafields() {
        const productHandles = await CustomFileReader.GetProductHandles();
        let completedProducts = 0;

        const startTime = Date.now();
        for (const productHandle of productHandles) {
            const productStartTime = Date.now();
            try {
                const sProduct = await this.source.GetProductByHandleOrThrow(productHandle);
                const tProduct = await this.target.GetProductByHandleOrThrow(productHandle);
                await this.SyncProductMetafields(sProduct, tProduct);
            } catch (err) {
                Logger.error(`Failed while sync Product Metafields, handle: ${productHandle}`, err);
                Sentry.captureException(err, {
                    tags: {
                        section: "SyncProductMetafield",
                        productHandle: productHandle
                    }
                });
            }

            const productElapsedTime = Date.now() - productStartTime;
            Logger.debug(`Sync completed for ${productHandle} in ${(productElapsedTime / 1000).toFixed(2)} seconds.`);

            completedProducts++;
            const elapsedTime = Date.now() - startTime;
            const avgTimePerProduct = elapsedTime / completedProducts;
            const remainingTime = avgTimePerProduct * (productHandles.length - completedProducts);

            Logger.debug(
                `Completed ${completedProducts}/${productHandles.length}. ` +
                `Estimated time remaining: ${(remainingTime / 1000).toFixed(2)} seconds.`
            );
        }
    }

    async SyncProductMetafields(sProduct?: ShopifyProduct, tProduct?: ShopifyProduct) {
        if (!sProduct) {
            throw new ProductServiceError(`Product not found at source`);
        }
        if (!tProduct) {
            throw new ProductServiceError(`Product not found at target`);
        }

        Logger.debug(`Sync Product Metafields, handle: ${sProduct.handle}{${sProduct.id}/${tProduct.id}}`);
        for (const sMetafield of sProduct.metafields) {
            const tMetafield = tProduct.metafields.find(mf => mf.namespace === sMetafield.namespace && mf.key === sMetafield.key)
            await this.metafieldService.SyncMetafield(tProduct.id, sMetafield, tMetafield);
        }

        for (const sProductVariant of sProduct.variants) {
            const tProductVariant = tProduct.variants.find(v => v.title === sProductVariant.title);
            if (!tProductVariant) {
                Logger.warn(`Product variant not found at target, title: ${sProductVariant.title}`);
                Sentry.captureMessage(`Product variant not found at target, title: ${sProductVariant.title}`);
                continue;
            }

            Logger.debug(`Sync Product Variant Metafields, title: ${sProductVariant.title}`);
            for (const sMetafield of sProductVariant.metafields) {
                const tMetafield = tProductVariant.metafields.find(mf => mf.namespace === sMetafield.namespace && mf.key === sMetafield.key);
                await this.metafieldService.SyncMetafield(tProductVariant.id, sMetafield, tMetafield);
            }
        }

        // Collect garbage metafields

        for (const tMetafield of tProduct.metafields) {
            const sMetafield = sProduct.metafields.find(mf => mf.namespace === tMetafield.namespace && mf.key === tMetafield.key);
            if (!sMetafield) {
                const deletedMetafield = await this.target.DeleteMetafields([{ ...tMetafield, ownerId: tProduct.id }]);
                Logger.info(`Deleted garbage Metafield: ${tMetafield.namespace}:${tMetafield.key} ${deletedMetafield}`);
            }
        }

        for (const tProductVariant of tProduct.variants) {
            const sProductVariant = sProduct.variants.find(v => v.title === tProductVariant.title);
            if (!sProductVariant) {
                Logger.warn(`Found garbage Product variant at target, title: ${tProductVariant.title}`);
                Sentry.captureMessage(`Found garbage Product variant at target, title: ${tProductVariant.title}`);
                continue;
            }

            for (const tMetafield of tProductVariant.metafields) {
                const sMetafield = sProductVariant.metafields.find(mf => mf.namespace === tMetafield.namespace && mf.key === tMetafield.key);
                if (!sMetafield) {
                    const deletedMetafield = await this.target.DeleteMetafields([{ ...tMetafield, ownerId: tProductVariant.id }]);
                    Logger.info(`Deleted garbage Metafield: ${tMetafield.namespace}:${tMetafield.key} ${deletedMetafield}`);
                }
            }
        }
    }
}