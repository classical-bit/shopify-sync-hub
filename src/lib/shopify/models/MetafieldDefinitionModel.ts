import { MetafieldDefinitionSchema, ShopifyMetafieldDefinition } from "../schemas/metafield/ShopifyMetafieldDefinition";

export class MetafieldDefinitionModel implements ShopifyMetafieldDefinition {
    id
    name
    namespace
    key
    ownerType
    type
    pinnedPosition
    access
    validations


    constructor(shopifyData: unknown) {
        const result = MetafieldDefinitionSchema.safeParse(shopifyData);
        if (!result.success) {
            throw new Error(`Invalid metafield definition data: ${JSON.stringify(result.error.format())}`);
        }
        const data = result.data;
        this.id = data.id;
        this.name = data.name;
        this.namespace = data.namespace;
        this.key = data.key;
        this.ownerType = data.ownerType;
        this.type = data.type;
        this.pinnedPosition = data.pinnedPosition;
        this.access = data.access;
        this.validations = data.validations;
    }

}