/**
 * Dev Server target options for Build Facade.
 */
export interface Schema {
    /**
     * List of hosts that are allowed to access the dev server.
     */
    allowedHosts?: string[];
    /**
     * Build using Ahead of Time compilation.
     * @deprecated Use the "aot" option in the browser builder instead.
     */
    aot?: boolean;
    /**
     * Base url for the application being built.
     * @deprecated Use the "baseHref" option in the browser builder instead.
     */
    baseHref?: string;
    /**
     * Target to serve.
     */
    browserTarget: string;
    /**
     * Use a separate bundle containing code used across multiple bundles.
     * @deprecated Use the "commonChunk" option in the browser builder instead.
     */
    commonChunk?: boolean;
    /**
     * URL where files will be deployed.
     * @deprecated Use the "deployUrl" option in the browser builder instead.
     */
    deployUrl?: string;
    /**
     * Don't verify connected clients are part of allowed hosts.
     */
    disableHostCheck?: boolean;
    /**
     * Enable hot module replacement.
     */
    hmr?: boolean;
    /**
     * Show a warning when the --hmr option is enabled.
     * @deprecated No longer has an effect.
     */
    hmrWarning?: boolean;
    /**
     * Host to listen on.
     */
    host?: string;
    /**
     * Whether to reload the page on change, using live-reload.
     */
    liveReload?: boolean;
    /**
     * Opens the url in default browser.
     */
    open?: boolean;
    /**
     * Enables optimization of the build output.
     * @deprecated Use the "optimization" option in the browser builder instead.
     */
    optimization?: OptimizationUnion;
    /**
     * Enable and define the file watching poll time period in milliseconds.
     */
    poll?: number;
    /**
     * Port to listen on.
     */
    port?: number;
    /**
     * Log progress to the console while building.
     * @deprecated Use the "progress" option in the browser builder instead.
     */
    progress?: boolean;
    /**
     * Proxy configuration file.
     */
    proxyConfig?: string;
    /**
     * The URL that the browser client (or live-reload client, if enabled) should use to connect
     * to the development server. Use for a complex dev server setup, such as one with reverse
     * proxies.
     */
    publicHost?: string;
    /**
     * The pathname where the app will be served.
     */
    servePath?: string;
    /**
     * Show a warning when deploy-url/base-href use unsupported serve path values.
     * @deprecated No longer has an effect.
     */
    servePathDefaultWarning?: boolean;
    /**
     * Output sourcemaps.
     * @deprecated Use the "sourceMap" option in the browser builder instead.
     */
    sourceMap?: SourceMapUnion;
    /**
     * Serve using HTTPS.
     */
    ssl?: boolean;
    /**
     * SSL certificate to use for serving HTTPS.
     */
    sslCert?: string;
    /**
     * SSL key to use for serving HTTPS.
     */
    sslKey?: string;
    /**
     * Use a separate bundle containing only vendor libraries.
     * @deprecated Use the "vendorChunk" option in the browser builder instead.
     */
    vendorChunk?: boolean;
    /**
     * Adds more details to output logging.
     */
    verbose?: boolean;
    /**
     * Rebuild on change.
     */
    watch?: boolean;
}
/**
 * Enables optimization of the build output.
 * @deprecated Use the "optimization" option in the browser builder instead.
 */
export declare type OptimizationUnion = boolean | OptimizationClass;
export interface OptimizationClass {
    /**
     * Enables optimization of the scripts output.
     */
    scripts?: boolean;
    /**
     * Enables optimization of the styles output.
     */
    styles?: boolean;
}
/**
 * Output sourcemaps.
 * @deprecated Use the "sourceMap" option in the browser builder instead.
 */
export declare type SourceMapUnion = boolean | SourceMapClass;
export interface SourceMapClass {
    /**
     * Output sourcemaps used for error reporting tools.
     */
    hidden?: boolean;
    /**
     * Output sourcemaps for all scripts.
     */
    scripts?: boolean;
    /**
     * Output sourcemaps for all styles.
     */
    styles?: boolean;
    /**
     * Resolve vendor packages sourcemaps.
     */
    vendor?: boolean;
}
