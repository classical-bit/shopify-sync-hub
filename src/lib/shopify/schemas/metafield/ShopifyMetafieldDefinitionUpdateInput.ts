import Zod from "zod";

const MetafieldDefinitionUpdateInputSchema = Zod.object({
    namespace: Zod.string(),
    key: Zod.string(),
    name: Zod.string().optional(),
    ownerType: Zod.string().optional(),
    pin: Zod.boolean().optional(),
    access: Zod.object({
        admin: Zod.string().optional(),
        customerAccount: Zod.string().optional(),
        storefront: Zod.string().optional(),
    }).optional(),
    validations: Zod.array(Zod.object({
        name: Zod.string(),
        value: Zod.string(),
    })).optional()
});

type ShopifyMetafieldDefinitionUpdateInput = Zod.infer<typeof MetafieldDefinitionUpdateInputSchema>;

export {
    ShopifyMetafieldDefinitionUpdateInput,
};
