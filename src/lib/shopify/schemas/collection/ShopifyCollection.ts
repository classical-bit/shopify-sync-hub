import Zod from "zod";

const CollectionSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    descriptionHtml: Zod.string(),
    title: Zod.string(),
    templateSuffix: Zod.string().nullable(),
});

type ShopifyCollection = Zod.infer<typeof CollectionSchema>;

export {
    CollectionSchema,
    ShopifyCollection,
};
