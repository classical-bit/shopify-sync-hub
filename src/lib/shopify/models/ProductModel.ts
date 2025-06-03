import { ShopifyProduct } from "../schemas/product/ShopifyProduct";
import { ProductResponseSchema } from "../schemas/product/ShopifyProductResponse";
import { ProductVariantSchema } from "../schemas/product/ShopifyProductVariant";
import { MediaModel } from "./FileModel";

export class ProductModel implements ShopifyProduct {
    id
    handle
    category
    title
    variants
    metafields
    collections
    media: MediaModel[]
    combinedListingRole
    descriptionHtml
    giftCardTemplateSuffix
    isGiftCard
    options
    productType
    requiresSellingPlan
    seo
    status
    tags
    templateSuffix
    vendor
    constructor(shopifyData: unknown) {
        const result = ProductResponseSchema.safeParse(shopifyData);
        if (!result.success) {
            throw new Error(`Invalid product data: ${JSON.stringify(result.error.format())}`);
        }
        const data = result.data;
        this.id = data.id;
        this.handle = data.handle;
        this.category = data.category;
        this.title = data.title;
        this.variants = data.variants.edges.map(edge => ProductVariantSchema.parse({
            ...edge.node,
            metafields: edge.node.metafields.edges.map(edge => edge.node),
            media: edge.node.media.edges.map(edge => edge.node),
        }));
        this.metafields = data.metafields.edges.map(edge => edge.node);
        this.collections = data.collections.edges.map(edge => edge.node);
        this.media = data.media.edges.map(edge => new MediaModel(edge.node));
        this.combinedListingRole = data.combinedListingRole;
        this.descriptionHtml = data.descriptionHtml;
        this.giftCardTemplateSuffix = data.giftCardTemplateSuffix;
        this.isGiftCard = data.isGiftCard;
        this.options = data.options;
        this.productType = data.productType;
        this.requiresSellingPlan = data.requiresSellingPlan;
        this.seo = data.seo;
        this.status = data.status;
        this.tags = data.tags;
        this.templateSuffix = data.templateSuffix;
        this.vendor = data.vendor;
    }
}