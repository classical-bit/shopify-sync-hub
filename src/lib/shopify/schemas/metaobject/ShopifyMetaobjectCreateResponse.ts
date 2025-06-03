import Zod from "zod";

const MetaobjectCreateResponseSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string()
});

type ShopifyMetaobjectCreateResponse = Zod.infer<typeof MetaobjectCreateResponseSchema>;

export {
    MetaobjectCreateResponseSchema,
    ShopifyMetaobjectCreateResponse,
};
