import Zod from "zod";
import { MetafieldSchema } from "../metafield/ShopifyMetafield";

const PageSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    title: Zod.string(),
    body: Zod.string(),
    isPublished: Zod.boolean(),
    templateSuffix: Zod.string(),
    metafields: Zod.object({
        nodes: Zod.array(MetafieldSchema),
    }),
});

type ShopifyPage = Zod.infer<typeof PageSchema>;

export {
    PageSchema,
    ShopifyPage,
};
