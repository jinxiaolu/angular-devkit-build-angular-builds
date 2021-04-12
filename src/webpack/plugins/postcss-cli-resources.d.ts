import { Plugin } from 'postcss';
export interface PostcssCliResourcesOptions {
    baseHref?: string;
    deployUrl?: string;
    resourcesOutputPath?: string;
    rebaseRootRelative?: boolean;
    /** CSS is extracted to a `.css` or is embedded in a `.js` file. */
    extracted?: boolean;
    filename: (resourcePath: string) => string;
    loader: any;
    emitFile: boolean;
}
export declare const postcss = true;
export default function (options?: PostcssCliResourcesOptions): Plugin;
