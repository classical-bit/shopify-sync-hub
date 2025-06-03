import 'dotenv/config';
import "./lib/utils/Sentry";
import { main } from "./lib/index";

export const rootDir = __dirname;
export const IsSafe = false;
main();
