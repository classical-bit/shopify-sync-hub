import Zod from "zod";

type MenuItem = {
    id: string;
    title: string;
    type: string;
    resourceId?: string;
    url?: string;
    tags?: string[];
    items: MenuItem[];
};

const MenuItemSchema: Zod.ZodType<MenuItem> = Zod.lazy(() =>
    Zod.object({
        id: Zod.string(),
        title: Zod.string(),
        type: Zod.string(),
        resourceId: Zod.string().optional(),
        url: Zod.string().optional(),
        tags: Zod.array(Zod.string()),
        items: Zod.array(MenuItemSchema),
    })
);

const MenuSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    isDefault: Zod.boolean(),
    title: Zod.string(),
    items: Zod.array(MenuItemSchema),
});

const ShopifyMenuItemCreateInputSchema: Zod.ZodType<any> = Zod.lazy(() =>
    Zod.object({
        title: Zod.string(),
        type: Zod.string(),
        resourceId: Zod.string().optional(),
        url: Zod.string().optional(),
        tags: Zod.array(Zod.string()),
        items: Zod.array(ShopifyMenuItemCreateInputSchema),
    })
);

const ShopifyMenuCreateInputSchema = Zod.object({
    handle: Zod.string(),
    title: Zod.string(),
    items: Zod.array(ShopifyMenuItemCreateInputSchema),
});

type ShopifyMenuItem = Zod.infer<typeof MenuItemSchema>;
type ShopifyMenu = Zod.infer<typeof MenuSchema>;
type ShopifyMenuItemCreateInput = Zod.infer<typeof ShopifyMenuItemCreateInputSchema>;
type ShopifyMenuCreateInput = Zod.infer<typeof ShopifyMenuCreateInputSchema>;

export {
    MenuItemSchema,
    MenuSchema,
    ShopifyMenuItemCreateInputSchema,
    ShopifyMenuCreateInputSchema,
    ShopifyMenuItem,
    ShopifyMenu,
    ShopifyMenuItemCreateInput,
    ShopifyMenuCreateInput,
};
