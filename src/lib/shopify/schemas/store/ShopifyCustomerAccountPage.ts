import Zod from "zod";

export const CustomerAccountPageSchema = Zod.object({
    id: Zod.string(),
    handle: Zod.string(),
    title: Zod.string()
});

export type ShopifyCustomerAccountPage = Zod.infer<typeof CustomerAccountPageSchema>;