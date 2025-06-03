import Zod from "zod";
import { MetaobjectFieldSchema } from "./ShopifyMetaobjectField";

const MetaobjectMetaobjectDefinitionSchema = Zod.object({
    id: Zod.string(),
    type: Zod.string(),
});
const MetaobjectSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    type: Zod.string(),
    definition: MetaobjectMetaobjectDefinitionSchema,
    fields: Zod.array(MetaobjectFieldSchema),
});

type ShopifyMetaobject = Zod.infer<typeof MetaobjectSchema>;

export {
    MetaobjectMetaobjectDefinitionSchema,
    MetaobjectSchema,
    ShopifyMetaobject,
};
