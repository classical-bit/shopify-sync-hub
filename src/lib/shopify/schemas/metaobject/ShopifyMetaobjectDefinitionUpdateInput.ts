import Zod from "zod";
import { MetaobjectDefinitionAccessInputSchema, MetaobjectDefinitionFieldDefinitionInputSchema, MetaobjectDefinitionValidationInputSchema } from "./ShopifyMetaobjectDefinitionCreateInput";

const MetaobjectFieldDefinitionCreateOperationInputSchema = Zod.object({
    key: Zod.string(),
    type: Zod.string(),
    description: Zod.string().nullable().optional(),
    name: Zod.string().optional(),
    required: Zod.boolean().optional(),
    validations: Zod.array(MetaobjectDefinitionValidationInputSchema).optional(),
});
type MetaobjectFieldDefinitionCreateOperationInput = Zod.infer<typeof MetaobjectFieldDefinitionCreateOperationInputSchema>;

const MetaobjectFieldDefinitionUpdateOperationInputSchema = Zod.object({
    key: Zod.string(),
    description: Zod.string().nullable().optional(),
    name: Zod.string().optional(),
    required: Zod.boolean().optional(),
    validations: Zod.array(MetaobjectDefinitionValidationInputSchema).optional(),
});
type MetaobjectFieldDefinitionUpdateOperationInput = Zod.infer<typeof MetaobjectFieldDefinitionUpdateOperationInputSchema>;

const MetaobjectFieldDefinitionOperationInputSchema = Zod.object({
    create: MetaobjectFieldDefinitionCreateOperationInputSchema.optional(),
    update: MetaobjectFieldDefinitionUpdateOperationInputSchema.optional(),
    delete: Zod.object({ key: Zod.string() }).optional()
});
type MetaobjectFieldDefinitionOperationInput = Zod.infer<typeof MetaobjectFieldDefinitionOperationInputSchema>;

const MetaobjectDefinitionUpdateInputSchema = Zod.object({
    name: Zod.string().optional(),
    description: Zod.string().optional(),
    displayNameKey: Zod.string().optional(),
    access: MetaobjectDefinitionAccessInputSchema.optional(),
    fieldDefinitions: Zod.array(MetaobjectFieldDefinitionOperationInputSchema).optional(),
});

type ShopifyMetaobjectDefinitionUpdateInput = Zod.infer<typeof MetaobjectDefinitionUpdateInputSchema>;

export {
    MetaobjectDefinitionUpdateInputSchema,
    MetaobjectFieldDefinitionCreateOperationInput,
    MetaobjectFieldDefinitionUpdateOperationInput,
    MetaobjectFieldDefinitionOperationInput,
    ShopifyMetaobjectDefinitionUpdateInput,
};
