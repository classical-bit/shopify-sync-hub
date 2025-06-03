import Zod from "zod";
import { MetafieldSchema } from "../metafield/ShopifyMetafield";
import { MediaSchema } from "../file/ShopifyMedia";
import { ProductVariantInventoryPolicySchema, VariantOptionValueSchema } from "./ShopifyProductResponseVariant";
import { ImageSchema } from "../file/ShopifyFile";



const CountryCodeSchema = Zod.string().length(2);

const CountryHarmonizedSystemCodeInputSchema = Zod.object({
    countryCode: CountryCodeSchema,
    harmonizedSystemCode: Zod.string(),
});

const ProductVariantWeightInputSchema = Zod.object({
    value: Zod.number(),
    unit: Zod.string(),
});

const ProductVariantInventoryItemMeasurementSchema = Zod.object({
    weight: ProductVariantWeightInputSchema,
});

const ProductVariantInventoryItemSchema = Zod.object({
    sku: Zod.string().nullable(),
    unitCost: Zod.object({ amount: Zod.string() }).nullable(),
    tracked: Zod.boolean(),
    countryCodeOfOrigin: CountryCodeSchema.nullable(),
    harmonizedSystemCode: Zod.string().nullable(),
    countryHarmonizedSystemCodes: Zod.object({
        nodes: Zod.array(CountryHarmonizedSystemCodeInputSchema),
    }),
    provinceCodeOfOrigin: Zod.string().nullable(),
    measurement: ProductVariantInventoryItemMeasurementSchema,
    requiresShipping: Zod.boolean(),
});

const ProductVariantSchema = Zod.object({
    id: Zod.string(),
    title: Zod.string(),
    sku: Zod.string().nullable(),
    metafields: Zod.array(MetafieldSchema),
    barcode: Zod.string().nullable(),
    compareAtPrice: Zod.string().nullable(),
    media: Zod.array(MediaSchema),
    inventoryPolicy: ProductVariantInventoryPolicySchema,
    inventoryQuantity: Zod.number(),
    inventoryItem: ProductVariantInventoryItemSchema,
    image: ImageSchema.nullable(),
    selectedOptions: Zod.array(VariantOptionValueSchema),
    price: Zod.string(),
    taxable: Zod.boolean(),
    taxCode: Zod.string().nullable(),
    requiresComponents: Zod.boolean(),
});

type ShopifyProductVariant = Zod.infer<typeof ProductVariantSchema>;

export {
    ProductVariantSchema,
    ShopifyProductVariant,
};
