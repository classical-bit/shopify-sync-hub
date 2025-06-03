import Zod from "zod";
import { CombinedListingsRoleSchema, ProductStatusSchema, SeoSchema } from "./ShopifyProduct";
import { MetafieldInputSchema } from "../metafield/ShopifyInputMetafield";


const ProductOptionCreateInputSchema = Zod.object({
    name: Zod.string(),
    position: Zod.number(),
    values: Zod.array(Zod.object({ name: Zod.string() })),
});

const ProductCreateInputSchema = Zod.object({
    handle: Zod.string().optional(),
    descriptionHtml: Zod.string().optional(),
    giftCard: Zod.boolean().optional(),
    category: Zod.string().nullable().optional(),
    claimOwnership: Zod.object({ bundles: Zod.boolean() }).optional(),
    collectionsToJoin: Zod.array(Zod.string()),
    combinedListingRole: CombinedListingsRoleSchema.optional(),
    productOptions: Zod.array(ProductOptionCreateInputSchema).optional(),
    productType: Zod.string().optional(),
    requiresSellingPlan: Zod.boolean().optional(),
    seo: SeoSchema.optional(),
    status: ProductStatusSchema.optional(),
    tags: Zod.array(Zod.string()).optional(),
    templateSuffix: Zod.string().nullable().optional(),
    giftCardTemplateSuffix: Zod.string().nullable().optional(),
    title: Zod.string(),
    vendor: Zod.string().optional(),
    metafields: Zod.array(MetafieldInputSchema).optional(),
});

type ShopifyProductCreateInput = Zod.infer<typeof ProductCreateInputSchema>;

export {
    ProductOptionCreateInputSchema,
    ProductCreateInputSchema,
    ShopifyProductCreateInput,
};
