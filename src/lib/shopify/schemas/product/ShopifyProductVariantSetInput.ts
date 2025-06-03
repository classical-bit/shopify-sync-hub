import Zod from "zod";
import { ProductVariantInventoryPolicySchema } from "./ShopifyProductResponseVariant";
import { MetafieldInputSchema } from "../metafield/ShopifyInputMetafield";
import { FileSetInputSchema } from "../file/ShopifyFileSetInput";

const InventoryLevelInputSchema = Zod.object({
    locationId: Zod.string(),
    availableQuantity: Zod.number(),
});

const InventoryItemInputSchema = Zod.object({
    sku: Zod.string().nullable(),
    cost: Zod.number().optional(),
    tracked: Zod.boolean(),
    countryCodeOfOrigin: Zod.string().optional(),
    harmonizedSystemCode: Zod.string().optional(),
    requiresShipping: Zod.boolean().optional(),
});

const VariantOptionValueInputSchema = Zod.object({
    name: Zod.string(),
    value: Zod.string(),
});

const ProductVariantSetInputSchema = Zod.object({
    barcode: Zod.string().optional(),
    compareAtPrice: Zod.string().optional(),
    id: Zod.string().optional(),
    inventoryPolicy: ProductVariantInventoryPolicySchema.default("DENY"),
    inventoryQuantities: Zod.array(InventoryLevelInputSchema).optional(),
    inventoryItem: InventoryItemInputSchema.optional(),
    metafields: Zod.array(MetafieldInputSchema).optional(),
    optionValues: Zod.array(VariantOptionValueInputSchema).min(1),
    sku: Zod.string().optional(),
    price: Zod.string().optional(),
    taxable: Zod.boolean().optional(),
    taxCode: Zod.string().optional(),
    requiresComponents: Zod.boolean().default(false),
    file: FileSetInputSchema.optional(),
    position: Zod.number().optional(),
});

export {
    InventoryLevelInputSchema,
    InventoryItemInputSchema,
    VariantOptionValueInputSchema,
    ProductVariantSetInputSchema,
}