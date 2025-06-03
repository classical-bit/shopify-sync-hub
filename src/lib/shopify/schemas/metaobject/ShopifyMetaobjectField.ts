import Zod from "zod";

const MetaobjectFieldSchema = Zod.object({
    key: Zod.string(),
    value: Zod.string().nullable(),
    type: Zod.string(),
});

type ShopifyMetaobjectField = Zod.infer<typeof MetaobjectFieldSchema>;

export {
    MetaobjectFieldSchema,
    ShopifyMetaobjectField,
};
