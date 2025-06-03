import Zod from "zod";
import { MetafieldSchema } from "../metafield/ShopifyMetafield";
import { CollectionSchema } from "../collection/ShopifyCollection";
import { MediaSchema } from "../file/ShopifyMedia";
import { CategorySchema, CombinedListingsRoleSchema, ProductOptionSchema, ProductStatusSchema, SeoSchema } from "./ShopifyProduct";
import { ProductVariantResponseSchema } from "./ShopifyProductResponseVariant";

const ProductResponseSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    title: Zod.string(),
    descriptionHtml: Zod.string(),
    isGiftCard: Zod.boolean(),
    collections: Zod.object({
        edges: Zod.array(Zod.object({ node: CollectionSchema })),
    }),
    media: Zod.object({
        edges: Zod.array(Zod.object({ node: MediaSchema })),
    }),
    combinedListingRole: CombinedListingsRoleSchema.nullable(),
    options: Zod.array(ProductOptionSchema),
    productType: Zod.string(),
    requiresSellingPlan: Zod.boolean(),
    seo: SeoSchema,
    status: ProductStatusSchema,
    tags: Zod.array(Zod.string()),
    templateSuffix: Zod.string().nullable(),
    giftCardTemplateSuffix: Zod.string().nullable(),
    vendor: Zod.string(),
    category: CategorySchema.nullable(),
    variants: Zod.object({
        edges: Zod.array(Zod.object({ node: ProductVariantResponseSchema })),
    }),
    metafields: Zod.object({
        edges: Zod.array(Zod.object({ node: MetafieldSchema })),
    }),
});

type ShopifyProductResponse = Zod.infer<typeof ProductResponseSchema>;

export {
    ProductResponseSchema,
    ShopifyProductResponse,
};
