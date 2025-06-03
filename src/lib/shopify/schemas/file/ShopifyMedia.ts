import Zod from "zod";
import { PreviewSchema } from "./ShopifyFile";

const MediaContentTypeSchema = Zod.enum([
    "EXTERNAL_VIDEO",
    "IMAGE",
    "MODEL_3D",
    "VIDEO",
]);

const MediaSchema = Zod.object({
    id: Zod.string(),
    alt: Zod.string().nullable(),
    mediaContentType: MediaContentTypeSchema,
    preview: PreviewSchema.nullable()
});

type ShopifyMedia = Zod.infer<typeof MediaSchema>;

export {
    MediaContentTypeSchema,
    MediaSchema,
    ShopifyMedia,
};
