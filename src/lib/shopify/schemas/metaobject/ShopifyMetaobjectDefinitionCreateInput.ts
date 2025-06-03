import Zod from "zod";

const MetaobjectDefinitionAccessInputSchema = Zod.object({
    storefront: Zod.boolean(),
});

const MetaobjectDefinitionValidationInputSchema = Zod.object({
    name: Zod.string(),
    value: Zod.string().nullable(),
});

const MetaobjectDefinitionFieldDefinitionInputSchema = Zod.object({
    description: Zod.string().nullable(),
    key: Zod.string(),
    name: Zod.string(),
    required: Zod.boolean(),
    type: Zod.string(),
    validations: Zod.array(MetaobjectDefinitionValidationInputSchema),
});

type ShopifyMetaobjectDefinitionFieldDefinitionInput = Zod.infer<typeof MetaobjectDefinitionFieldDefinitionInputSchema>;

const MetaobjectDefinitionCreateInputSchema = Zod.object({
    type: Zod.string(),
    name: Zod.string(),
    displayNameKey: Zod.string().nullable(),
    access: MetaobjectDefinitionAccessInputSchema,
    fieldDefinitions: Zod.array(MetaobjectDefinitionFieldDefinitionInputSchema),
});

type ShopifyMetaobjectDefinitionCreateInput = Zod.infer<typeof MetaobjectDefinitionCreateInputSchema>;

export {
    MetaobjectDefinitionAccessInputSchema,
    MetaobjectDefinitionValidationInputSchema,
    MetaobjectDefinitionFieldDefinitionInputSchema,
    MetaobjectDefinitionCreateInputSchema,
    ShopifyMetaobjectDefinitionFieldDefinitionInput,
    ShopifyMetaobjectDefinitionCreateInput,
};
