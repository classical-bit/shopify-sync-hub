import Zod from "zod";
import { MetafieldSchema } from "../metafield/ShopifyMetafield";

const ImageSchema = Zod.object({
    altText: Zod.string().nullable(),
    height: Zod.number().int(),
    id: Zod.string(),
    url: Zod.string().url(),
    width: Zod.number().int(),
});

const PreviewSchema = Zod.object({
    image: ImageSchema,
});

const FileSchema = Zod.object({
    id: Zod.string(),
    preview: PreviewSchema,
});

type ShopifyFile = Zod.infer<typeof FileSchema>;

export {
    ImageSchema,
    PreviewSchema,
    FileSchema,
    ShopifyFile,
};
