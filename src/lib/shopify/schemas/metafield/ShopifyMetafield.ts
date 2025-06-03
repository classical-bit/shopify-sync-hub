import Zod from "zod";

const MetafieldSchema = Zod.object({
    id: Zod.string(),
    ownerType: Zod.string(),
    namespace: Zod.string(),
    key: Zod.string(),
    type: Zod.string(),
    value: Zod.string(),
    description: Zod.string().nullable()
});

type ShopifyMetafield = Zod.infer<typeof MetafieldSchema>;

export {
    MetafieldSchema,
    ShopifyMetafield,
}