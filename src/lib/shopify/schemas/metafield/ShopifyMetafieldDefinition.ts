import Zod from "zod";

const MetafieldDefinitionSchema = Zod.object({
    id: Zod.string(),
    name: Zod.string(),
    namespace: Zod.string(),
    key: Zod.string(),
    ownerType: Zod.string(),
    type: Zod.object({
        category: Zod.string(),
        name: Zod.string(),
    }),
    pinnedPosition: Zod.number().nullable(),
    access: Zod.object({
        admin: Zod.string(),
        customerAccount: Zod.string(),
        storefront: Zod.string(),
    }),
    validations: Zod.array(Zod.object({
        name: Zod.string(),
        type: Zod.string(),
        value: Zod.string(),
    }))
});

type ShopifyMetafieldDefinition = Zod.infer<typeof MetafieldDefinitionSchema>;

export {
    MetafieldDefinitionSchema,
    ShopifyMetafieldDefinition,
};
