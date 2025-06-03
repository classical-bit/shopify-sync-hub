import Zod from "zod";
import { MetafieldInputSchema } from "../metafield/ShopifyInputMetafield";
import { ProductVariantInventoryPolicySchema } from "./ShopifyProductResponseVariant";

const CountryCodeSchema = Zod.string().length(2);

const InventoryLevelInputSchema = Zod.object({
  locationId: Zod.string(),
  availableQuantity: Zod.number(),
});

const CountryHarmonizedSystemCodeInputSchema = Zod.object({
  countryCode: CountryCodeSchema,
  harmonizedSystemCode: Zod.string(),
});

const WeightInputSchema = Zod.object({
  value: Zod.number(),
  unit: Zod.string(),
});

const InventoryItemMeasurementInputSchema = Zod.object({
  weight: WeightInputSchema.optional(),
});

const InventoryItemInputSchema = Zod.object({
  sku: Zod.string().nullable(),
  cost: Zod.string().optional(),
  tracked: Zod.boolean(),
  countryCodeOfOrigin: CountryCodeSchema.nullable().optional(),
  harmonizedSystemCode: Zod.string().nullable().optional(),
  countryHarmonizedSystemCodes: Zod.array(CountryHarmonizedSystemCodeInputSchema).optional(),
  provinceCodeOfOrigin: Zod.string().nullable().optional(),
  measurement: InventoryItemMeasurementInputSchema.optional(),
  requiresShipping: Zod.boolean().optional(),
});

const VariantOptionValueInputSchema = Zod.object({
  name: Zod.string(),
  optionName: Zod.string(),
});

const ProductVariantsBulkInputSchema = Zod.object({
  barcode: Zod.string().nullable().optional(),
  compareAtPrice: Zod.string().nullable().optional(),
  id: Zod.string().optional(),
  inventoryPolicy: ProductVariantInventoryPolicySchema.default("DENY").optional(),
  inventoryQuantities: Zod.array(InventoryLevelInputSchema).optional(),
  inventoryItem: InventoryItemInputSchema.optional(),
  metafields: Zod.array(MetafieldInputSchema).optional(),
  optionValues: Zod.array(VariantOptionValueInputSchema).optional(),
  price: Zod.string().optional(),
  taxable: Zod.boolean().optional(),
  taxCode: Zod.string().nullable().optional(),
  requiresComponents: Zod.boolean().default(false).optional(),
  mediaSrc: Zod.array(Zod.string()).optional(),
  mediaId: Zod.string().nullable().optional(),
});

type ShopifyProductVariantsBulkInput = Zod.infer<typeof ProductVariantsBulkInputSchema>;

export {
  CountryCodeSchema,
  InventoryLevelInputSchema,
  CountryHarmonizedSystemCodeInputSchema,
  WeightInputSchema,
  InventoryItemMeasurementInputSchema,
  InventoryItemInputSchema,
  VariantOptionValueInputSchema,
  ProductVariantsBulkInputSchema,
  ShopifyProductVariantsBulkInput,
};
