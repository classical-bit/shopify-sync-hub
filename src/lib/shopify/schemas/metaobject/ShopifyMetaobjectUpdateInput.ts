import Zod from "zod";

const MetaobjectFieldUpdateInputSchema = Zod.object({
    key: Zod.string(),
    value: Zod.string().nullable(),
});

type ShopifyMetaobjectFieldUpdateInput = Zod.infer<typeof MetaobjectFieldUpdateInputSchema>;

const MetaobjectUpdateInputSchema = Zod.object({
    handle: Zod.string(),
    fields: Zod.array(MetaobjectFieldUpdateInputSchema).optional(),
});

type ShopifyMetaobjectUpdateInput = Zod.infer<typeof MetaobjectUpdateInputSchema>;

export {
    ShopifyMetaobjectFieldUpdateInput,
    MetaobjectUpdateInputSchema,
    ShopifyMetaobjectUpdateInput,
};
