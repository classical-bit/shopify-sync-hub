import Zod from "zod";

const FileContentTypeSchema = Zod.enum(["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"]);
const FileCreateInputDuplicateResolutionModeSchema = Zod.enum(["APPEND_UUID", "OVERWRITE"]);

const FileSetInputSchema = Zod.object({
    filename: Zod.string().optional(),
    contentType: FileContentTypeSchema.optional(),
    alt: Zod.string().nullable().optional(),
    duplicateResolutionMode: FileCreateInputDuplicateResolutionModeSchema.default("APPEND_UUID"),
    id: Zod.string().optional(),
    originalSource: Zod.string(),
});

type ShopifyFileSetInput = Zod.infer<typeof FileSetInputSchema>

export {
    FileContentTypeSchema,
    FileCreateInputDuplicateResolutionModeSchema,
    FileSetInputSchema,
    ShopifyFileSetInput,
};
