import Zod from "zod";
import { MediaContentTypeSchema } from "./ShopifyMedia";

const CreateMediaInputSchema = Zod.object({
    alt: Zod.string().nullable().optional(),
    mediaContentType: MediaContentTypeSchema,
    originalSource: Zod.string()
});

type ShopifyCreateMediaInput = Zod.infer<typeof CreateMediaInputSchema>;

export {
    CreateMediaInputSchema,
    ShopifyCreateMediaInput,
};
