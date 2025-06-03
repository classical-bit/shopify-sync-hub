import Zod from "zod";
import { CombinedListingsRoleSchema, ProductStatusSchema, SeoSchema } from "./ShopifyProduct";
import { MetafieldInputSchema } from "../metafield/ShopifyInputMetafield";
import { ProductVariantSetInputSchema } from "./ShopifyProductVariantSetInput";
import { FileSetInputSchema } from "../file/ShopifyFileSetInput";

const ProductClaimOwnershipInputSchema = Zod.object({
    bundles: Zod.boolean().default(false),
});

const OptionValueSetInputSchema = Zod.object({
    id: Zod.string().optional(), // ID field for updates
    name: Zod.string(),
});

const LinkedMetafieldCreateInputSchema = Zod.object({
    namespace: Zod.string(),
    key: Zod.string(),
    values: Zod.array(Zod.string()).optional(),
});

const OptionSetInputSchema = Zod.object({
    id: Zod.string().optional(), // ID field for updates
    name: Zod.string(),
    position: Zod.number(),
    values: Zod.array(OptionValueSetInputSchema).min(1), // Ensuring at least one value
    linkedMetafield: LinkedMetafieldCreateInputSchema.optional(),
});

const ProductSetInputSchema = Zod.object({
    id: Zod.string(),
    descriptionHtml: Zod.string(),
    handle: Zod.string(),
    seo: SeoSchema,
    productType: Zod.string(),
    category: Zod.string(),
    tags: Zod.array(Zod.string()),
    templateSuffix: Zod.string().optional(),
    giftCardTemplateSuffix: Zod.string().optional(),
    title: Zod.string(),
    vendor: Zod.string(),
    giftCard: Zod.boolean().optional(),
    redirectNewHandle: Zod.boolean().optional(),
    collections: Zod.array(Zod.string()),
    metafields: Zod.array(MetafieldInputSchema),
    variants: Zod.array(ProductVariantSetInputSchema),
    files: Zod.array(FileSetInputSchema),
    status: ProductStatusSchema,
    requiresSellingPlan: Zod.boolean().optional(),
    productOptions: Zod.array(OptionSetInputSchema).max(3),
    claimOwnership: ProductClaimOwnershipInputSchema.optional(),
    combinedListingRole: CombinedListingsRoleSchema.optional(),
});

type ShopifyProductSetInput = Zod.infer<typeof ProductSetInputSchema>;

export {
    ProductClaimOwnershipInputSchema,
    OptionValueSetInputSchema,
    LinkedMetafieldCreateInputSchema,
    OptionSetInputSchema,
    ProductSetInputSchema,
    ShopifyProductSetInput,
};
