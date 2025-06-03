import Zod from "zod";
import { ProductStatusSchema, SeoSchema } from "./ShopifyProduct";
import { MetafieldInputSchema } from "../metafield/ShopifyInputMetafield";

const ProductUpdateInputSchema = Zod.object({
    id: Zod.string(),
    descriptionHtml: Zod.string().optional(),
    handle: Zod.string().optional(),
    seo: SeoSchema.optional(),
    productType: Zod.string().optional(),
    category: Zod.string().nullable().optional(),
    tags: Zod.array(Zod.string()).optional(),
    templateSuffix: Zod.string().nullable().optional(),
    giftCardTemplateSuffix: Zod.string().nullable().optional(),
    title: Zod.string().optional(),
    vendor: Zod.string().optional(),
    redirectNewHandle: Zod.boolean().optional(),
    collectionsToJoin: Zod.array(Zod.string()).optional(),
    collectionsToLeave: Zod.array(Zod.string()).optional(),
    deleteConflictingConstrainedMetafields: Zod.boolean().default(false).optional(),
    metafields: Zod.array(MetafieldInputSchema).optional(),
    status: ProductStatusSchema.optional(),
    requiresSellingPlan: Zod.boolean().optional()
});

type ShopifyProductUpdateInput = Zod.infer<typeof ProductUpdateInputSchema>;

export {
    ProductUpdateInputSchema,
    ShopifyProductUpdateInput,
};
