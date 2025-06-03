import axios from 'axios';
import _ from "lodash";
import { readFileSync } from "fs";
import { join, } from "path";
import { Logger } from "../utils/Logger";
import { ShopifyMenu, ShopifyMenuCreateInput } from './schemas/store/ShopifyMenu';
import { FileModel } from './models/FileModel';
import { MetafieldDefinitionModel } from './models/MetafieldDefinitionModel';
import { ProductModel } from './models/ProductModel';
import { MetaobjectModel } from './models/MetaobjectModel';
import { rootDir } from '../..';
import { ShopifyProductCreateInput } from './schemas/product/ShopifyProductCreateInput';
import { ShopifyCreateMediaInput } from './schemas/file/ShopifyCreateMediaInput';
import { ShopifyProductUpdateInput } from './schemas/product/ShopifyProductUpdateInput';
import { ShopifyPage } from './schemas/store/ShopifyPage';
import { ShopifyProductVariantsBulkInput } from './schemas/product/ShopifyProductVariantsBulkInput';
import { ShopifyProductSetInput } from './schemas/product/ShopifyProductSetInput';
import { ShopifyMetaobjectDefinitionCreateInput } from './schemas/metaobject/ShopifyMetaobjectDefinitionCreateInput';
import { ShopifyMetaobjectDefinitionUpdateInput } from './schemas/metaobject/ShopifyMetaobjectDefinitionUpdateInput';
import { ShopifyMetaobjectDefinition } from './schemas/metaobject/ShopifyMetaobjectDefinition';
import Sentry from '../utils/Sentry';
import { ShopifyMetafieldDefinitionUpdateInput } from './schemas/metafield/ShopifyMetafieldDefinitionUpdateInput';
import { ShopifyCollectionCreateInput } from './schemas/collection/ShopifyCollectionCreateInput';
import { ShopifyCollection } from './schemas/collection/ShopifyCollection';
import { ShopifyFileSetInput } from './schemas/file/ShopifyFileSetInput';

type EdgeConnection<T> = { node: T };
export class ShopifyConnectionError extends Error {
  constructor(message: string, private shopName: string, private query: string, private variables: string, private errors: string) {
    super(message + ` (${shopName})`);
    this.name = "ShopifyConnectionError";
    this.query = query;
    this.variables = variables;
    this.errors = errors;
  }
}

export class ShopifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyError";
  }
}

export class ShopifyConnection {
  private shopName;
  private http;
  constructor(config: { shopName: string, accessToken: string }) {
    this.shopName = config.shopName;
    this.http = axios.create({
      baseURL: `https://${this.shopName}.myshopify.com/admin/api/${process.env.API_VERSION || "2025-01"}/graphql.json`,
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      }
    });
  }


  async GetMenus(): Promise<ShopifyMenu[]> {
    const query = this.readQueryFile("GetMenus.gql");

    const response = await this.#ShopifyGraphqlRequest(query);
    const ret = response.menus.edges.map((medge: any) => medge.node);
    return ret
  }

  async DeleteMenu(gid: string) {
    const query = this.readQueryFile("DeleteMenu.gql")

    const variables = {
      id: gid
    }
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    return response.menuDelete.deletedMenuId;
  }

  async CreateMenu(menu: ShopifyMenuCreateInput) {
    const query = this.readQueryFile("CreateMenu.gql");

    const response = await this.#ShopifyGraphqlRequest(query, menu);
    if (response.menuCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to create menu.",
        this.shopName,
        query,
        JSON.stringify(menu),
        JSON.stringify({ userErrors: response.menuCreate.userErrors }));
    }
    return response.menuCreate.menu;
  }

  async GetCustomerAccountPages() {
    const query = this.readQueryFile("GetCustomerAccountPages.gql");

    const response = await this.#ShopifyGraphqlRequest(query);
    return response.customerAccountPages.nodes;
  }

  async *GetProducts(): AsyncGenerator<ProductModel[]> {
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        Logger.debug(`Fetching Products... (${this.shopName})`);
        const query = this.readQueryFile("GetProducts.gql");

        const response = await this.#ShopifyGraphqlRequest(query, { cursor });
        yield response.products.edges.map((edge: EdgeConnection<unknown>) => new ProductModel(edge.node));
        hasNextPage = response.products.pageInfo.hasNextPage;
        cursor = response.products.pageInfo.endCursor;

      } catch (err: any) {
        Logger.error(`Failed fetching Products (${this.shopName}):`, err.response?.data || err.message);
        Sentry.captureException(err);
      }
    }

  }

  async GetProductByHandle(handle: string): Promise<ProductModel | undefined> {
    const query = this.readQueryFile("GetProductByHandle.gql");
    const response = (await this.#ShopifyGraphqlRequest(query, {
      handle
    })).productByIdentifier
    if (!response) return undefined;
    return new ProductModel(response);
  }

  async GetProductByHandleOrThrow(handle: string): Promise<ProductModel> {
    const query = this.readQueryFile("GetProductByHandle.gql");
    const response = (await this.#ShopifyGraphqlRequest(query, {
      handle
    })).productByIdentifier
    if (!response) throw new ShopifyError(`Not found Product with handle: ${handle} (${this.shopName})`);
    return new ProductModel(response);
  }

  async GetProduct(gid: string): Promise<ProductModel | undefined> {
    const query = this.readQueryFile("GetProduct.gql");
    const response = (await this.#ShopifyGraphqlRequest(query, {
      id: gid
    })).product;
    if (!response) return undefined;
    return new ProductModel(response);
  }

  async GetProductOrThrow(gid: string): Promise<ProductModel> {
    const query = this.readQueryFile("GetProduct.gql");
    const response = (await this.#ShopifyGraphqlRequest(query, {
      id: gid
    })).product;
    if (!response) throw new ShopifyError(`Not found pProduct with id: ${gid} (${this.shopName})`);
    return new ProductModel(response);
  }

  async CreateProductSynchronous(product: ShopifyProductSetInput, synchronous: boolean = false) {
    const query = this.readQueryFile("CreateProductSynchronous.gql");
    const variables = {
      input: product
    };
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.productSet.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to set Product.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.productSet.userErrors }));
    }
    return response.productSet.product;
  }

  async CreateProduct(product: ShopifyProductCreateInput, media: ShopifyCreateMediaInput[]) {
    const query = this.readQueryFile("CreateProduct.gql");
    const variables = {
      product,
      media
    };
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.productCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to create Product.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.productCreate.userErrors }));
    }
    return response.productCreate.product;
  }

  async BulkCreateProductVariants(productId: string, variants: ShopifyProductVariantsBulkInput[]) {
    const query = this.readQueryFile("BulkCreateProductVariants.gql");
    const chunks = _.chunk(variants, 100);
    const createdVariants = [];
    for (const chunk of chunks) {
      Logger.debug(`Creating Product Variants... (${this.shopName})`);
      const variables = {
        productId,
        variants: chunk
      };
      const response = await this.#ShopifyGraphqlRequest(query, variables);
      if (response.productVariantsBulkCreate.userErrors.length > 0) {
        const variantLimitExceededError = response.productVariantsBulkCreate.userErrors.find((err: any) => err.message === "Exceeded maximum number of variants allowed")
        if (variantLimitExceededError) {
          Logger.warn(`Exceeded maximum number of variants allowed for product: ${productId}`);
          return [];
        }
        throw new ShopifyConnectionError("Failed to bulk create Product Variants.",
          this.shopName,
          query,
          JSON.stringify(variables),
          JSON.stringify({ userErrors: response.productVariantsBulkCreate.userErrors }));
      }
      createdVariants.push(...response.productVariantsBulkCreate.productVariants);
    }
    return createdVariants;
  }

  async BulkUpdateProductVariants(productId: string, variants: ShopifyProductVariantsBulkInput[]) {
    const query = this.readQueryFile("BulkUpdateProductVariants.gql");
    const chunks = _.chunk(variants, 100);
    const updatedVariants = [];
    for (const chunk of chunks) {
      Logger.debug(`Updating Product Variants... (${this.shopName})`);
      const variables = {
        productId,
        variants: chunk
      };
      const response = await this.#ShopifyGraphqlRequest(query, variables);
      if (response.productVariantsBulkUpdate.userErrors.length > 0) {
        throw new ShopifyConnectionError("Failed to bulk update Product Variants.",
          this.shopName,
          query,
          JSON.stringify(variables),
          JSON.stringify({ userErrors: response.productVariantsBulkUpdate.userErrors }));
      }
      updatedVariants.push(...response.productVariantsBulkUpdate.productVariants);
    }
    return updatedVariants;

  }

  async UpdateProduct(product: ShopifyProductUpdateInput) {
    const query = this.readQueryFile("UpdateProduct.gql");
    const variables = {
      input: product
    };
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.productUpdate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to update Product.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.productUpdate.userErrors }));
    }
    return response.productUpdate.product;
  }

  async CreateFiles(files: ShopifyFileSetInput[]) {
    const query = this.readQueryFile("CreateFiles.gql");
    const chunks = _.chunk(files, 250);
    const createdFiles = [];
    for (const chunk of chunks) {
      Logger.debug(`Creating Files... (${this.shopName})`);
      const variables = {
        files: chunk
      };
      const response = await this.#ShopifyGraphqlRequest(query, variables);
      if (response.fileCreate.userErrors.length > 0) {
        throw new ShopifyConnectionError("Failed to create file.",
          this.shopName,
          query,
          JSON.stringify(variables),
          JSON.stringify({ userErrors: response.fileCreate.userErrors }));
      }
      createdFiles.push(...response.fileCreate.files);
    }
    return createdFiles;
  }

  async GetFiles() {
    const files: FileModel[] = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      Logger.debug(`Fetching Files... (${this.shopName})`);
      try {
        const query = this.readQueryFile("GetFiles.gql");

        const response = await this.#ShopifyGraphqlRequest(query, { cursor });
        files.push(...response.files.edges.map((edge: any) => new FileModel(edge.node)));
        hasNextPage = response.files.pageInfo.hasNextPage;
        cursor = response.files.pageInfo.endCursor;
      } catch (err: any) {
        Logger.error(`Failed fetching files (${this.shopName}):`, err.response?.data || err.message);
        Sentry.captureException(err);
      }
    }

    return files
  }

  async GetFileById(gid: string) {
    const files = await this.#GetFileByQuery(`id:${gid.split("/").pop()}`);
    if (files[0]) return files[0];
    return undefined;
  }

  async GetFileByName(name: string) {
    const files = await this.#GetFileByQuery(`filename:${name}`);
    const file = files.find(f => f.GetName() === name);
    if (file) return file;
    return undefined;
  }

  async #GetFileByQuery(fileQuery: string): Promise<FileModel[]> {
    const query = this.readQueryFile("GetFile.gql");

    const response = await this.#ShopifyGraphqlRequest(query, { query: fileQuery });
    return response.files.nodes.map((node: unknown) => new FileModel(node));
  }

  async GetPages(): Promise<ShopifyPage[]> {
    const pages = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      Logger.debug(`Fetching Pages... (${this.shopName})`);
      try {
        const query = this.readQueryFile("GetPages.gql");

        const response = await this.#ShopifyGraphqlRequest(query, { cursor });
        pages.push(...response.pages.edges.map((edge: any) => edge.node));
        hasNextPage = response.pages.pageInfo.hasNextPage;
        cursor = response.pages.pageInfo.endCursor;
      } catch (err: any) {
        Logger.error(`Failed fetching pages (${this.shopName}):`, err.response?.data || err.message);
        Sentry.captureException(err);
      }
    }

    return pages
  }

  async CreatePage(page: any): Promise<ShopifyPage> {
    const query = this.readQueryFile("CreatePage.gql");

    const variables = {
      input: page
    }

    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.pageCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to create page.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.pageCreate.userErrors }));
    }
    return response.pageCreate.page;
  }

  async GetCollectionByHandle(handle: string): Promise<ShopifyCollection | undefined> {
    const query = this.readQueryFile("GetCollectionByHandle.gql");
    const response = (await this.#ShopifyGraphqlRequest(query, {
      handle
    })).collectionByIdentifier;
    return response;
  }

  async GetCollection(gid: string): Promise<ShopifyCollection | undefined> {
    const query = this.readQueryFile("GetCollection.gql");
    const response = (await this.#ShopifyGraphqlRequest(query, {
      id: gid
    })).collection;
    return response;
  }

  async GetCollections() {
    const query = this.readQueryFile("GetCollections.gql");
    const collections = [];
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        Logger.debug(`Fetching Collections... (${this.shopName})`);
        const response = await this.#ShopifyGraphqlRequest(query, { cursor });
        collections.push(...response.collections.edges.map((edge: any) => edge.node));
        hasNextPage = response.collections.pageInfo.hasNextPage;
        cursor = response.collections.pageInfo.endCursor;
      } catch (err: any) {
        Logger.error(`Failed fetching collections (${this.shopName}):`, err.response?.data || err.message);
        Sentry.captureException(err);
      }
    }

    return collections;
  }

  async CreateCollection(collection: ShopifyCollectionCreateInput) {
    const query = this.readQueryFile("CreateCollection.gql");
    const variables = {
      collection
    };
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.collectionCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to create Collection.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.collectionCreate.userErrors }));
    }
    return response.collectionCreate.collection;
  }

  async DeleteCollection(gid: string) {
    const query = this.readQueryFile("DeleteCollection.gql")

    const variables = {
      id: gid
    }
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.collectionDelete.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to delete Collection.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.collectionDelete.userErrors }));
    }
    return response.collectionDelete.deletedCollectionId;
  }

  async SetMetafields(metafields: any) {
    const query = this.readQueryFile("SetMetafields.gql");
    const chunks = _.chunk(metafields, 250);
    const setMetafields = [];
    for (const chunk of chunks) {
      Logger.debug(`Set Metafields... (${this.shopName})`);
      const response = await this.#ShopifyGraphqlRequest(query, { input: chunk });
      if (response.metafieldsSet.userErrors.length > 0) {
        throw new ShopifyConnectionError("Failed to create metafield.",
          this.shopName,
          query,
          JSON.stringify({ input: chunk }),
          JSON.stringify({ userErrors: response.metafieldsSet.userErrors }));
      }
      setMetafields.push(...response.metafieldsSet.metafields);
    }
    return setMetafields;
  }

  async DeleteMetafields(identifiers: { ownerId: string, namespace: string, key: string }[]) {
    const query = this.readQueryFile("DeleteMetafield.gql");
    const chunks = _.chunk(identifiers, 250);
    const deletedMetafields = [];
    for (const chunk of chunks) {
      Logger.debug(`Deleting Metafields... (${this.shopName})`);
      const response = await this.#ShopifyGraphqlRequest(query, {
        input: chunk.map(each => ({ ownerId: each.ownerId, namespace: each.namespace, key: each.key }))
      });
      if (response.metafieldsDelete.userErrors.length > 0) {
        throw new ShopifyConnectionError("Failed to delete metafield.",
          this.shopName,
          query,
          JSON.stringify({ input: chunk }),
          JSON.stringify({ userErrors: response.metafieldsDelete.userErrors }));
      }
      deletedMetafields.push(...response.metafieldsDelete.deletedMetafields);
    }
    return deletedMetafields;
  }

  async GetMetafieldDefinitions(ownerType: string): Promise<MetafieldDefinitionModel[]> {
    const query = this.readQueryFile("GetMetafieldDefinitions.gql");

    const response = await this.#ShopifyGraphqlRequest(query, { ownerType });
    return response.metafieldDefinitions.nodes.map((node: unknown) => new MetafieldDefinitionModel(node));
  }

  async CreateMetafieldDefinition(metafieldDef: any) {
    const query = this.readQueryFile("CreateMetafieldDefinition.gql");

    const variables = {
      input: metafieldDef
    }

    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.metafieldDefinitionCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError(`Failed to create Metaobject Definition. (${this.shopName})`,
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.metafieldDefinitionCreate.userErrors }));
    }
    return response.metafieldDefinitionCreate.createdDefinition;
  }

  async * GetMetaobjects(type: string): AsyncGenerator<MetaobjectModel[]> {
    let cursor = null;
    let hasNextPage = true;

    while (hasNextPage) {
      try {
        Logger.debug(`Fetching Metaobjects... (${this.shopName})`);
        const query = this.readQueryFile("GetMetaobjects.gql");
        const response = await this.#ShopifyGraphqlRequest(query, { type, cursor });
        yield response.metaobjects.edges.map((edge: any) => edge.node);
        hasNextPage = response.metaobjects.pageInfo.hasNextPage;
        cursor = response.metaobjects.pageInfo.endCursor;
      } catch (err: any) {
        Logger.error(`Failed fetching metaobjects (${this.shopName}):`, err.response?.data || err.message);
        Sentry.captureException(err);
      }
    }
  }

  async GetMetaobject(gid: string): Promise<MetaobjectModel | undefined> {
    const query = this.readQueryFile("GetMetaobject.gql");

    const response = await this.#ShopifyGraphqlRequest(query, { id: gid });
    if (!response.metaobject) return undefined;
    return new MetaobjectModel(response.metaobject);
  }

  async DeleteMetaobject(gid: string): Promise<string> {
    const query = this.readQueryFile("DeleteMetaobject.gql");

    const response = await this.#ShopifyGraphqlRequest(query, { id: gid });
    return response.metaobjectDelete.deletedId;
  }

  async GetMetaobjectByHandle(type: string, handle: string): Promise<MetaobjectModel | undefined> {
    const query = this.readQueryFile("GetMetaobjectByHandle.gql");

    const response = await this.#ShopifyGraphqlRequest(query, { type, handle });
    if (!response.metaobjectByHandle) return undefined
    return new MetaobjectModel(response.metaobjectByHandle);
  }

  async CreateMetaobject(metaobject: any) {
    const query = this.readQueryFile("CreateMetaobject.gql");

    const variables = {
      input: metaobject
    }

    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.metaobjectCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to create Metaobject.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.metaobjectCreate.userErrors }));
    }
    return response.metaobjectCreate.metaobject;
  }

  async GetMetaobjectDefinition(gid: string) {
    const query = this.readQueryFile("GetMetaobjectDefinition.gql");

    const response = await this.#ShopifyGraphqlRequest(query, { id: gid });
    return response.metaobjectDefinition;
  }

  async GetMetaobjectDefinitions(): Promise<ShopifyMetaobjectDefinition[]> {
    const query = this.readQueryFile("GetMetaobjectDefinitions.gql");

    const response = await this.#ShopifyGraphqlRequest(query);

    return response.metaobjectDefinitions.nodes;
  }

  async CreateMetaobjectDefinition(metaobjectDef: ShopifyMetaobjectDefinitionCreateInput) {
    const query = this.readQueryFile("CreateMetaobjectDefinition.gql");

    const variables = {
      input: metaobjectDef
    }

    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.metaobjectDefinitionCreate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to create Metaobject Definition.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.metaobjectDefinitionCreate.userErrors }));
    }
    return response.metaobjectDefinitionCreate.metaobjectDefinition;
  }

  async UpdateMetaobjectDefinition(id: string, metaobjectDef: ShopifyMetaobjectDefinitionUpdateInput) {
    const query = this.readQueryFile("UpdateMetaobjectDefinition.gql");

    const variables = {
      id,
      input: metaobjectDef
    }

    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.metaobjectDefinitionUpdate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to update Metaobject Definition.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.metaobjectDefinitionUpdate.userErrors }));
    }
    return response.metaobjectDefinitionUpdate.metaobjectDefinition;
  }

  async UpdateMetafieldDefinition(definition: ShopifyMetafieldDefinitionUpdateInput) {
    const query = this.readQueryFile("UpdateMetafieldDefinition.gql");

    const variables = {
      definition
    }

    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.metafieldDefinitionUpdate.userErrors.length > 0) {
      throw new ShopifyConnectionError("Failed to update Metaobject Definition.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.metafieldDefinitionUpdate.userErrors }));
    }
    return response.metafieldDefinitionUpdate.updatedDefinition;
  }

  async DeleteMetaobjectDefinition(gid: string) {
    const query = this.readQueryFile("DeleteMetaobjectDefinition.gql")

    const variables = {
      id: gid
    }
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    return response.metaobjectDefinitionDelete.deletedId;
  }

  async DeleteMetaobjects(type: string) {
    const query = this.readQueryFile("DeleteMetaobjects.gql")

    const variables = {
      type
    }
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    if (response.metaobjectBulkDelete.userErrors.length > 0) {
      if (response.metaobjectBulkDelete.userErrors[0].message === "Your job has been enqueued and will run shortly.") {
        console.log(`Delete metaobjects type: ${type} job has been enqueued and will run shortly.`);
        return response.metaobjectBulkDelete;
      }
      throw new ShopifyConnectionError("Failed to bulk delete Metaobject.",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ userErrors: response.metaobjectBulkDelete.userErrors }));
    }
    return response.metaobjectBulkDelete;
  }

  async DeleteMetafieldDefinition(gid: string) {
    const query = this.readQueryFile("DeleteMetafieldDefinition.gql")

    const variables = {
      id: gid
    }
    const response = await this.#ShopifyGraphqlRequest(query, variables);
    return response.metafieldDefinitionDelete.deletedDefinitionId;
  }

  private readQueryFile(filename: string) {
    return readFileSync(join(rootDir, "../queries", filename), "utf-8")
  }

  async #ShopifyGraphqlRequest(query: string, variables: any = null) {
    const response = await this.http.post("", { query, variables });
    if (response.data.errors) {
      throw new ShopifyConnectionError("Shopify Request failed",
        this.shopName,
        query,
        JSON.stringify(variables),
        JSON.stringify({ errors: response.data.errors }));
    }
    return response.data.data;
  }
}
