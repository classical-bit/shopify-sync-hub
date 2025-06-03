import { MetaobjectSchema, ShopifyMetaobject } from "../schemas/metaobject/ShopifyMetaobject";

export class MetaobjectModel implements ShopifyMetaobject {
    id
    handle
    type
    definition
    fields
    constructor(shopifyData: unknown) {
        const result = MetaobjectSchema.safeParse(shopifyData);
        if (!result.success) {
            throw new Error(`Invalid metaobject data: ${JSON.stringify(result.error.format())}`);
        }
        const data = result.data;
        this.id = data.id;
        this.handle = data.handle;
        this.type = data.type;
        this.definition = data.definition;
        this.fields = data.fields;
    }
}