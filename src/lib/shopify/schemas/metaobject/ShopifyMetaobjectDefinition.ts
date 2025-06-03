import Zod from "zod";
import { MetaobjectSchema } from "./ShopifyMetaobject";

const MetaobjectDefinitionAccessSchema = Zod.object({
    admin: Zod.boolean(),
    storefront: Zod.boolean(),
});

const MetaobjectDefinitionFieldDefinitionFieldTypeSchema = Zod.object({
    category: Zod.string(),
    name: Zod.string(),
});

const MetaobjectDefinitionFieldDefinitionValidationSchema = Zod.object({
    name: Zod.string(),
    type: Zod.string(),
    value: Zod.string().nullable(),
});

const MetaobjectDefinitionFieldDefinitionSchema = Zod.object({
    description: Zod.string().nullable(),
    key: Zod.string(),
    name: Zod.string(),
    required: Zod.boolean(),
    type: MetaobjectDefinitionFieldDefinitionFieldTypeSchema,
    validations: Zod.array(MetaobjectDefinitionFieldDefinitionValidationSchema),
});

const MetaobjectDefinitionSchema = Zod.object({
    id: Zod.string(),
    type: Zod.string(),
    name: Zod.string(),
    displayNameKey: Zod.string().nullable(),
    access: MetaobjectDefinitionAccessSchema,
    fieldDefinitions: Zod.array(MetaobjectDefinitionFieldDefinitionSchema),
    metaobjects: Zod.object({
        edges: Zod.array(Zod.object({ node: MetaobjectSchema }))
    })
});

type ShopifyMetaobjectDefinition = Zod.infer<typeof MetaobjectDefinitionSchema>;

export {
    MetaobjectDefinitionAccessSchema,
    MetaobjectDefinitionFieldDefinitionFieldTypeSchema,
    MetaobjectDefinitionFieldDefinitionValidationSchema,
    MetaobjectDefinitionFieldDefinitionSchema,
    MetaobjectDefinitionSchema,
    ShopifyMetaobjectDefinition,
};
