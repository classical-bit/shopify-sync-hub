import Zod from "zod";
import { MetafieldSchema } from "../metafield/ShopifyMetafield";
import { MediaSchema } from "../file/ShopifyMedia";
import { ImageSchema } from "../file/ShopifyFile";

const ProductVariantInventoryPolicySchema = Zod.enum(["DENY", "CONTINUE"]);

const VariantOptionValueSchema = Zod.object({
    name: Zod.string(),
    optionValue: Zod.object({ name: Zod.string() }),
    value: Zod.string(),
});


const CountryCodeSchema = Zod.string().length(2);

const CountryHarmonizedSystemCodeInputSchema = Zod.object({
    countryCode: CountryCodeSchema,
    harmonizedSystemCode: Zod.string(),
});

const WeightInputSchema = Zod.object({
    value: Zod.number(),
    unit: Zod.string(),
});

const ProductResponseVariantInventoryItemMeasurementSchema = Zod.object({
    weight: WeightInputSchema,
});

const ProductResponseVariantInventoryItemSchema = Zod.object({
    sku: Zod.string().nullable(),
    unitCost: Zod.object({ amount: Zod.string() }).nullable(),
    tracked: Zod.boolean(),
    countryCodeOfOrigin: CountryCodeSchema.nullable(),
    harmonizedSystemCode: Zod.string().nullable(),
    countryHarmonizedSystemCodes: Zod.object({
        nodes: Zod.array(CountryHarmonizedSystemCodeInputSchema),
    }),
    provinceCodeOfOrigin: Zod.string().nullable(),
    measurement: ProductResponseVariantInventoryItemMeasurementSchema,
    requiresShipping: Zod.boolean(),
});


const ProductVariantResponseSchema = Zod.object({
    id: Zod.string(),
    title: Zod.string(),
    sku: Zod.string().nullable(),
    metafields: Zod.object({
        edges: Zod.array(Zod.object({ node: MetafieldSchema })),
    }),
    barcode: Zod.string().nullable(),
    compareAtPrice: Zod.string().nullable(),
    media: Zod.object({
        edges: Zod.array(Zod.object({ node: MediaSchema })),
    }),
    inventoryPolicy: ProductVariantInventoryPolicySchema,
    inventoryQuantity: Zod.number(),
    inventoryItem: ProductResponseVariantInventoryItemSchema,
    image: ImageSchema.nullable(),
    selectedOptions: Zod.array(VariantOptionValueSchema),
    price: Zod.string(),
    taxable: Zod.boolean(),
    taxCode: Zod.string().nullable(),
    requiresComponents: Zod.boolean(),
});

export {
    ProductVariantInventoryPolicySchema,
    VariantOptionValueSchema,
    ProductVariantResponseSchema,
}