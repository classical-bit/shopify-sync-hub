import Zod from "zod";


const MetafieldInputSchema = Zod.object({
    key: Zod.string(),
    namespace: Zod.string(),
    type: Zod.string(),
    value: Zod.string()
});

type ShopifyInputMetafield = Zod.infer<typeof MetafieldInputSchema>;

export {
    MetafieldInputSchema,
    ShopifyInputMetafield,
};
