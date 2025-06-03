import Zod from "zod";
import { MetafieldSchema } from "../metafield/ShopifyMetafield";
import { CollectionSchema } from "../collection/ShopifyCollection";
import { MediaSchema } from "../file/ShopifyMedia";
import { ProductVariantSchema } from "./ShopifyProductVariant";

const ProductStatusSchema = Zod.enum([
    "ACTIVE",
    "ARCHIVED",
    "DRAFT",
]);

const CombinedListingsRoleSchema = Zod.enum(["CHILD", "PARENT"]);

const CategorySchema = Zod.object({
    id: Zod.string(),
    name: Zod.string(),
});


const ProductOptionSchema = Zod.object({
    linkedMetafield: Zod.object({
        key: Zod.string().nullable(),
        namespace: Zod.string().nullable(),
    }).nullable(),
    name: Zod.string(),
    position: Zod.number(),
    optionValues: Zod.array(Zod.object({
        name: Zod.string(),
    })),
    values: Zod.array(Zod.string()),
});

const SeoSchema = Zod.object({
    description: Zod.string().nullable(),
    title: Zod.string().nullable(),
});

const ProductSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    title: Zod.string(),
    descriptionHtml: Zod.string(),
    isGiftCard: Zod.boolean(),
    collections: Zod.array(CollectionSchema),
    media: Zod.array(MediaSchema),
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
    variants: Zod.array(ProductVariantSchema),
    metafields: Zod.array(MetafieldSchema),
});

type ShopifyProduct = Zod.infer<typeof ProductSchema>;

export {
    ProductStatusSchema,
    CombinedListingsRoleSchema,
    CategorySchema,
    ProductOptionSchema,
    SeoSchema,
    ProductSchema,
    ShopifyProduct,
};
