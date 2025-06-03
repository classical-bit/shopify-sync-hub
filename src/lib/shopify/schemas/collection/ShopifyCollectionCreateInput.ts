import Zod from "zod";

const CollectionCreateInputSchema = Zod.object({
    handle: Zod.string(),
    descriptionHtml: Zod.string().optional(),
    title: Zod.string().optional(),
    templateSuffix: Zod.string().nullable().optional(),
});

type ShopifyCollectionCreateInput = Zod.infer<typeof CollectionCreateInputSchema>;

export {
    CollectionCreateInputSchema,
    ShopifyCollectionCreateInput,
};
