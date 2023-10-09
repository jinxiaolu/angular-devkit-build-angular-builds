"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeBuild = void 0;
const node_assert_1 = __importDefault(require("node:assert"));
const source_file_cache_1 = require("../../tools/esbuild/angular/source-file-cache");
const application_code_bundle_1 = require("../../tools/esbuild/application-code-bundle");
const budget_stats_1 = require("../../tools/esbuild/budget-stats");
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const bundler_execution_result_1 = require("../../tools/esbuild/bundler-execution-result");
const commonjs_checker_1 = require("../../tools/esbuild/commonjs-checker");
const global_scripts_1 = require("../../tools/esbuild/global-scripts");
const global_styles_1 = require("../../tools/esbuild/global-styles");
const index_html_generator_1 = require("../../tools/esbuild/index-html-generator");
const license_extractor_1 = require("../../tools/esbuild/license-extractor");
const utils_1 = require("../../tools/esbuild/utils");
const bundle_calculator_1 = require("../../utils/bundle-calculator");
const copy_assets_1 = require("../../utils/copy-assets");
const environment_options_1 = require("../../utils/environment-options");
const prerender_1 = require("../../utils/server-rendering/prerender");
const service_worker_1 = require("../../utils/service-worker");
const supported_browsers_1 = require("../../utils/supported-browsers");
const i18n_1 = require("./i18n");
// eslint-disable-next-line max-lines-per-function
async function executeBuild(options, context, rebuildState) {
    const startTime = process.hrtime.bigint();
    const { projectRoot, workspaceRoot, serviceWorker, optimizationOptions, serverEntryPoint, assets, indexHtmlOptions, cacheOptions, prerenderOptions, appShellOptions, ssrOptions, verbose, } = options;
    const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
    const target = (0, utils_1.transformSupportedBrowsersToTargets)(browsers);
    // Load active translations if inlining
    // TODO: Integrate into watch mode and only load changed translations
    if (options.i18nOptions.shouldInline) {
        await (0, i18n_1.loadActiveTranslations)(context, options.i18nOptions);
    }
    // Reuse rebuild state or create new bundle contexts for code and global stylesheets
    let bundlerContexts = rebuildState?.rebuildContexts;
    const codeBundleCache = rebuildState?.codeBundleCache ??
        new source_file_cache_1.SourceFileCache(cacheOptions.enabled ? cacheOptions.path : undefined);
    if (bundlerContexts === undefined) {
        bundlerContexts = [];
        // Browser application code
        bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, (0, application_code_bundle_1.createBrowserCodeBundleOptions)(options, target, codeBundleCache)));
        // Global Stylesheets
        if (options.globalStyles.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_styles_1.createGlobalStylesBundleOptions)(options, target, initial, codeBundleCache?.loadResultCache);
                if (bundleOptions) {
                    bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, bundleOptions, () => initial));
                }
            }
        }
        // Global Scripts
        if (options.globalScripts.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_scripts_1.createGlobalScriptsBundleOptions)(options, initial);
                if (bundleOptions) {
                    bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, bundleOptions, () => initial));
                }
            }
        }
        // Server application code
        // Skip server build when non of the features are enabled.
        if (serverEntryPoint && (prerenderOptions || appShellOptions || ssrOptions)) {
            const nodeTargets = (0, utils_1.getSupportedNodeTargets)();
            bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, (0, application_code_bundle_1.createServerCodeBundleOptions)(options, [...target, ...nodeTargets], codeBundleCache), () => false));
        }
    }
    const bundlingResult = await bundler_context_1.BundlerContext.bundleAll(bundlerContexts);
    // Log all warnings and errors generated during bundling
    await (0, utils_1.logMessages)(context, bundlingResult);
    const executionResult = new bundler_execution_result_1.ExecutionResult(bundlerContexts, codeBundleCache);
    // Return if the bundling has errors
    if (bundlingResult.errors) {
        return executionResult;
    }
    const { metafile, initialFiles, outputFiles } = bundlingResult;
    executionResult.outputFiles.push(...outputFiles);
    // Check metafile for CommonJS module usage if optimizing scripts
    if (optimizationOptions.scripts) {
        const messages = (0, commonjs_checker_1.checkCommonJSModules)(metafile, options.allowedCommonJsDependencies);
        await (0, utils_1.logMessages)(context, { warnings: messages });
    }
    /**
     * Index HTML content without CSS inlining to be used for server rendering (AppShell, SSG and SSR).
     *
     * NOTE: we don't perform critical CSS inlining as this will be done during server rendering.
     */
    let indexContentOutputNoCssInlining;
    // Generate index HTML file
    // If localization is enabled, index generation is handled in the inlining process.
    // NOTE: Localization with SSR is not currently supported.
    if (indexHtmlOptions && !options.i18nOptions.shouldInline) {
        const { content, contentWithoutCriticalCssInlined, errors, warnings } = await (0, index_html_generator_1.generateIndexHtml)(initialFiles, executionResult.outputFiles, {
            ...options,
            optimizationOptions,
        }, 
        // Set lang attribute to the defined source locale if present
        options.i18nOptions.hasDefinedSourceLocale ? options.i18nOptions.sourceLocale : undefined);
        indexContentOutputNoCssInlining = contentWithoutCriticalCssInlined;
        printWarningsAndErrorsToConsole(context, warnings, errors);
        executionResult.addOutputFile(indexHtmlOptions.output, content, bundler_context_1.BuildOutputFileType.Browser);
        if (ssrOptions) {
            executionResult.addOutputFile('index.server.html', contentWithoutCriticalCssInlined, bundler_context_1.BuildOutputFileType.Server);
        }
    }
    // Pre-render (SSG) and App-shell
    // If localization is enabled, prerendering is handled in the inlining process.
    if ((prerenderOptions || appShellOptions) && !options.i18nOptions.shouldInline) {
        (0, node_assert_1.default)(indexContentOutputNoCssInlining, 'The "index" option is required when using the "ssg" or "appShell" options.');
        const { output, warnings, errors } = await (0, prerender_1.prerenderPages)(workspaceRoot, appShellOptions, prerenderOptions, executionResult.outputFiles, indexContentOutputNoCssInlining, optimizationOptions.styles.inlineCritical, environment_options_1.maxWorkers, verbose);
        printWarningsAndErrorsToConsole(context, warnings, errors);
        for (const [path, content] of Object.entries(output)) {
            executionResult.addOutputFile(path, content, bundler_context_1.BuildOutputFileType.Browser);
        }
    }
    // Copy assets
    if (assets) {
        // The webpack copy assets helper is used with no base paths defined. This prevents the helper
        // from directly writing to disk. This should eventually be replaced with a more optimized helper.
        executionResult.addAssets(await (0, copy_assets_1.copyAssets)(assets, [], workspaceRoot));
    }
    // Extract and write licenses for used packages
    if (options.extractLicenses) {
        executionResult.addOutputFile('3rdpartylicenses.txt', await (0, license_extractor_1.extractLicenses)(metafile, workspaceRoot), bundler_context_1.BuildOutputFileType.Root);
    }
    // Augment the application with service worker support
    // If localization is enabled, service worker is handled in the inlining process.
    if (serviceWorker && !options.i18nOptions.shouldInline) {
        try {
            const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorker, options.baseHref || '/', executionResult.outputFiles, executionResult.assetFiles);
            executionResult.addOutputFile('ngsw.json', serviceWorkerResult.manifest, bundler_context_1.BuildOutputFileType.Browser);
            executionResult.addAssets(serviceWorkerResult.assetFiles);
        }
        catch (error) {
            context.logger.error(error instanceof Error ? error.message : `${error}`);
            return executionResult;
        }
    }
    // Analyze files for bundle budget failures if present
    let budgetFailures;
    if (options.budgets) {
        const compatStats = (0, budget_stats_1.generateBudgetStats)(metafile, initialFiles);
        budgetFailures = [...(0, bundle_calculator_1.checkBudgets)(options.budgets, compatStats, true)];
        for (const { severity, message } of budgetFailures) {
            if (severity === 'error') {
                context.logger.error(message);
            }
            else {
                context.logger.warn(message);
            }
        }
    }
    // Calculate estimated transfer size if scripts are optimized
    let estimatedTransferSizes;
    if (optimizationOptions.scripts || optimizationOptions.styles.minify) {
        estimatedTransferSizes = await (0, utils_1.calculateEstimatedTransferSizes)(executionResult.outputFiles);
    }
    (0, utils_1.logBuildStats)(context, metafile, initialFiles, budgetFailures, estimatedTransferSizes);
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Application bundle generation complete. [${buildTime.toFixed(3)} seconds]`);
    // Perform i18n translation inlining if enabled
    if (options.i18nOptions.shouldInline) {
        const { errors, warnings } = await (0, i18n_1.inlineI18n)(options, executionResult, initialFiles);
        printWarningsAndErrorsToConsole(context, warnings, errors);
    }
    // Write metafile if stats option is enabled
    if (options.stats) {
        executionResult.addOutputFile('stats.json', JSON.stringify(metafile, null, 2), bundler_context_1.BuildOutputFileType.Root);
    }
    return executionResult;
}
exports.executeBuild = executeBuild;
function printWarningsAndErrorsToConsole(context, warnings, errors) {
    for (const error of errors) {
        context.logger.error(error);
    }
    for (const warning of warnings) {
        context.logger.warn(warning);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZS1idWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2V4ZWN1dGUtYnVpbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7Ozs7O0FBR0gsOERBQWlDO0FBQ2pDLHFGQUFnRjtBQUNoRix5RkFHcUQ7QUFDckQsbUVBQXVFO0FBQ3ZFLHlFQUEwRjtBQUMxRiwyRkFBNkY7QUFDN0YsMkVBQTRFO0FBQzVFLHVFQUFzRjtBQUN0RixxRUFBb0Y7QUFDcEYsbUZBQTZFO0FBQzdFLDZFQUF3RTtBQUN4RSxxREFNbUM7QUFDbkMscUVBQTZEO0FBQzdELHlEQUFxRDtBQUNyRCx5RUFBNkQ7QUFDN0Qsc0VBQXdFO0FBQ3hFLCtEQUFnRjtBQUNoRix1RUFBc0U7QUFDdEUsaUNBQTREO0FBRzVELGtEQUFrRDtBQUMzQyxLQUFLLFVBQVUsWUFBWSxDQUNoQyxPQUEwQyxFQUMxQyxPQUF1QixFQUN2QixZQUEyQjtJQUUzQixNQUFNLFNBQVMsR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO0lBRTFDLE1BQU0sRUFDSixXQUFXLEVBQ1gsYUFBYSxFQUNiLGFBQWEsRUFDYixtQkFBbUIsRUFDbkIsZ0JBQWdCLEVBQ2hCLE1BQU0sRUFDTixnQkFBZ0IsRUFDaEIsWUFBWSxFQUNaLGdCQUFnQixFQUNoQixlQUFlLEVBQ2YsVUFBVSxFQUNWLE9BQU8sR0FDUixHQUFHLE9BQU8sQ0FBQztJQUVaLE1BQU0sUUFBUSxHQUFHLElBQUEseUNBQW9CLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRSxNQUFNLE1BQU0sR0FBRyxJQUFBLDJDQUFtQyxFQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTdELHVDQUF1QztJQUN2Qyxx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S0FBSyxFQUFFO1FBQ2pCLGVBQWUsQ0FBQyxhQUFhLENBQzNCLFlBQVksRUFDWixJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsQ0FBQyxDQUFDLEVBQ2pDLHFDQUFtQixDQUFDLElBQUksQ0FDekIsQ0FBQztLQUNIO0lBRUQsT0FBTyxlQUFlLENBQUM7QUFDekIsQ0FBQztBQWpRRCxvQ0FpUUM7QUFFRCxTQUFTLCtCQUErQixDQUN0QyxPQUF1QixFQUN2QixRQUFrQixFQUNsQixNQUFnQjtJQUVoQixLQUFLLE1BQU0sS0FBSyxJQUFJLE1BQU0sRUFBRTtRQUMxQixPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQztLQUM3QjtJQUNELEtBQUssTUFBTSxPQUFPLElBQUksUUFBUSxFQUFFO1FBQzlCLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQzlCO0FBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdub2RlOmFzc2VydCc7XG5pbXBvcnQgeyBTb3VyY2VGaWxlQ2FjaGUgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2FuZ3VsYXIvc291cmNlLWZpbGUtY2FjaGUnO1xuaW1wb3J0IHtcbiAgY3JlYXRlQnJvd3NlckNvZGVCdW5kbGVPcHRpb25zLFxuICBjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyxcbn0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9hcHBsaWNhdGlvbi1jb2RlLWJ1bmRsZSc7XG5pbXBvcnQgeyBnZW5lcmF0ZUJ1ZGdldFN0YXRzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9idWRnZXQtc3RhdHMnO1xuaW1wb3J0IHsgQnVpbGRPdXRwdXRGaWxlVHlwZSwgQnVuZGxlckNvbnRleHQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBFeGVjdXRpb25SZXN1bHQsIFJlYnVpbGRTdGF0ZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcbmltcG9ydCB7IGNoZWNrQ29tbW9uSlNNb2R1bGVzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9jb21tb25qcy1jaGVja2VyJztcbmltcG9ydCB7IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9nbG9iYWwtc2NyaXB0cyc7XG5pbXBvcnQgeyBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9nbG9iYWwtc3R5bGVzJztcbmltcG9ydCB7IGdlbmVyYXRlSW5kZXhIdG1sIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBleHRyYWN0TGljZW5zZXMgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2xpY2Vuc2UtZXh0cmFjdG9yJztcbmltcG9ydCB7XG4gIGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMsXG4gIGdldFN1cHBvcnRlZE5vZGVUYXJnZXRzLFxuICBsb2dCdWlsZFN0YXRzLFxuICBsb2dNZXNzYWdlcyxcbiAgdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMsXG59IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvdXRpbHMnO1xuaW1wb3J0IHsgY2hlY2tCdWRnZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvYnVuZGxlLWNhbGN1bGF0b3InO1xuaW1wb3J0IHsgY29weUFzc2V0cyB9IGZyb20gJy4uLy4uL3V0aWxzL2NvcHktYXNzZXRzJztcbmltcG9ydCB7IG1heFdvcmtlcnMgfSBmcm9tICcuLi8uLi91dGlscy9lbnZpcm9ubWVudC1vcHRpb25zJztcbmltcG9ydCB7IHByZXJlbmRlclBhZ2VzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc2VydmVyLXJlbmRlcmluZy9wcmVyZW5kZXInO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IGlubGluZUkxOG4sIGxvYWRBY3RpdmVUcmFuc2xhdGlvbnMgfSBmcm9tICcuL2kxOG4nO1xuaW1wb3J0IHsgTm9ybWFsaXplZEFwcGxpY2F0aW9uQnVpbGRPcHRpb25zIH0gZnJvbSAnLi9vcHRpb25zJztcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG1heC1saW5lcy1wZXItZnVuY3Rpb25cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlQnVpbGQoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHJlYnVpbGRTdGF0ZT86IFJlYnVpbGRTdGF0ZSxcbik6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpO1xuXG4gIGNvbnN0IHtcbiAgICBwcm9qZWN0Um9vdCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHNlcnZpY2VXb3JrZXIsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBzZXJ2ZXJFbnRyeVBvaW50LFxuICAgIGFzc2V0cyxcbiAgICBpbmRleEh0bWxPcHRpb25zLFxuICAgIGNhY2hlT3B0aW9ucyxcbiAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgIGFwcFNoZWxsT3B0aW9ucyxcbiAgICBzc3JPcHRpb25zLFxuICAgIHZlcmJvc2UsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKTtcbiAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoYnJvd3NlcnMpO1xuXG4gIC8vIExvYWQgYWN0aXZlIHRyYW5zbGF0aW9ucyBpZiBpbmxpbmluZ1xuICAvLyBUT0RPOiBJbnRlZ3JhdGUgaW50byB3YXRjaCBtb2RlIGFuZCBvbmx5IGxvYWQgY2hhbmdlZCB0cmFuc2xhdGlvbnNcbiAgaWYgKG9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgYXdhaXQgbG9hZEFjdGl2ZVRyYW5zbGF0aW9ucyhjb250ZXh0LCBvcHRpb25zLmkxOG5PcHRpb25zKTtcbiAgfVxuXG4gIC8vIFJldXNlIHJlYnVpbGQgc3RhdGUgb3IgY3JlYXRlIG5ldyBidW5kbGUgY29udGV4dHMgZm9yIGNvZGUgYW5kIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBsZXQgYnVuZGxlckNvbnRleHRzID0gcmVidWlsZFN0YXRlPy5yZWJ1aWxkQ29udGV4dHM7XG4gIGNvbnN0IGNvZGVCdW5kbGVDYWNoZSA9XG4gICAgcmVidWlsZFN0YXRlPy5jb2RlQnVuZGxlQ2FjaGUgPz9cbiAgICBuZXcgU291cmNlRmlsZUNhY2hlKGNhY2hlT3B0aW9ucy5lbmFibGVkID8gY2FjaGVPcHRpb25zLnBhdGggOiB1bmRlZmluZWQpO1xuICBpZiAoYnVuZGxlckNvbnRleHRzID09PSB1bmRlZmluZWQpIHtcbiAgICBidW5kbGVyQ29udGV4dHMgPSBbXTtcblxuICAgIC8vIEJyb3dzZXIgYXBwbGljYXRpb24gY29kZVxuICAgIGJ1bmRsZXJDb250ZXh0cy5wdXNoKFxuICAgICAgbmV3IEJ1bmRsZXJDb250ZXh0KFxuICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAhIW9wdGlvbnMud2F0Y2gsXG4gICAgICAgIGNyZWF0ZUJyb3dzZXJDb2RlQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQsIGNvZGVCdW5kbGVDYWNoZSksXG4gICAgICApLFxuICAgICk7XG5cbiAgICAvLyBHbG9iYWwgU3R5bGVzaGVldHNcbiAgICBpZiAob3B0aW9ucy5nbG9iYWxTdHlsZXMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsIG9mIFt0cnVlLCBmYWxzZV0pIHtcbiAgICAgICAgY29uc3QgYnVuZGxlT3B0aW9ucyA9IGNyZWF0ZUdsb2JhbFN0eWxlc0J1bmRsZU9wdGlvbnMoXG4gICAgICAgICAgb3B0aW9ucyxcbiAgICAgICAgICB0YXJnZXQsXG4gICAgICAgICAgaW5pdGlhbCxcbiAgICAgICAgICBjb2RlQnVuZGxlQ2FjaGU/LmxvYWRSZXN1bHRDYWNoZSxcbiAgICAgICAgKTtcbiAgICAgICAgaWYgKGJ1bmRsZU9wdGlvbnMpIHtcbiAgICAgICAgICBidW5kbGVyQ29udGV4dHMucHVzaChcbiAgICAgICAgICAgIG5ldyBCdW5kbGVyQ29udGV4dCh3b3Jrc3BhY2VSb290LCAhIW9wdGlvbnMud2F0Y2gsIGJ1bmRsZU9wdGlvbnMsICgpID0+IGluaXRpYWwpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBHbG9iYWwgU2NyaXB0c1xuICAgIGlmIChvcHRpb25zLmdsb2JhbFNjcmlwdHMubGVuZ3RoID4gMCkge1xuICAgICAgZm9yIChjb25zdCBpbml0aWFsIG9mIFt0cnVlLCBmYWxzZV0pIHtcbiAgICAgICAgY29uc3QgYnVuZGxlT3B0aW9ucyA9IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zKG9wdGlvbnMsIGluaXRpYWwpO1xuICAgICAgICBpZiAoYnVuZGxlT3B0aW9ucykge1xuICAgICAgICAgIGJ1bmRsZXJDb250ZXh0cy5wdXNoKFxuICAgICAgICAgICAgbmV3IEJ1bmRsZXJDb250ZXh0KHdvcmtzcGFjZVJvb3QsICEhb3B0aW9ucy53YXRjaCwgYnVuZGxlT3B0aW9ucywgKCkgPT4gaW5pdGlhbCksXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFNlcnZlciBhcHBsaWNhdGlvbiBjb2RlXG4gICAgLy8gU2tpcCBzZXJ2ZXIgYnVpbGQgd2hlbiBub24gb2YgdGhlIGZlYXR1cmVzIGFyZSBlbmFibGVkLlxuICAgIGlmIChzZXJ2ZXJFbnRyeVBvaW50ICYmIChwcmVyZW5kZXJPcHRpb25zIHx8IGFwcFNoZWxsT3B0aW9ucyB8fCBzc3JPcHRpb25zKSkge1xuICAgICAgY29uc3Qgbm9kZVRhcmdldHMgPSBnZXRTdXBwb3J0ZWROb2RlVGFyZ2V0cygpO1xuICAgICAgYnVuZGxlckNvbnRleHRzLnB1c2goXG4gICAgICAgIG5ldyBCdW5kbGVyQ29udGV4dChcbiAgICAgICAgICB3b3Jrc3BhY2VSb290LFxuICAgICAgICAgICEhb3B0aW9ucy53YXRjaCxcbiAgICAgICAgICBjcmVhdGVTZXJ2ZXJDb2RlQnVuZGxlT3B0aW9ucyhvcHRpb25zLCBbLi4udGFyZ2V0LCAuLi5ub2RlVGFyZ2V0c10sIGNvZGVCdW5kbGVDYWNoZSksXG4gICAgICAgICAgKCkgPT4gZmFsc2UsXG4gICAgICAgICksXG4gICAgICApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGJ1bmRsaW5nUmVzdWx0ID0gYXdhaXQgQnVuZGxlckNvbnRleHQuYnVuZGxlQWxsKGJ1bmRsZXJDb250ZXh0cyk7XG5cbiAgLy8gTG9nIGFsbCB3YXJuaW5ncyBhbmQgZXJyb3JzIGdlbmVyYXRlZCBkdXJpbmcgYnVuZGxpbmdcbiAgYXdhaXQgbG9nTWVzc2FnZXMoY29udGV4dCwgYnVuZGxpbmdSZXN1bHQpO1xuXG4gIGNvbnN0IGV4ZWN1dGlvblJlc3VsdCA9IG5ldyBFeGVjdXRpb25SZXN1bHQoYnVuZGxlckNvbnRleHRzLCBjb2RlQnVuZGxlQ2FjaGUpO1xuXG4gIC8vIFJldHVybiBpZiB0aGUgYnVuZGxpbmcgaGFzIGVycm9yc1xuICBpZiAoYnVuZGxpbmdSZXN1bHQuZXJyb3JzKSB7XG4gICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgfVxuXG4gIGNvbnN0IHsgbWV0YWZpbGUsIGluaXRpYWxGaWxlcywgb3V0cHV0RmlsZXMgfSA9IGJ1bmRsaW5nUmVzdWx0O1xuXG4gIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcy5wdXNoKC4uLm91dHB1dEZpbGVzKTtcblxuICAvLyBDaGVjayBtZXRhZmlsZSBmb3IgQ29tbW9uSlMgbW9kdWxlIHVzYWdlIGlmIG9wdGltaXppbmcgc2NyaXB0c1xuICBpZiAob3B0aW1pemF0aW9uT3B0aW9ucy5zY3JpcHRzKSB7XG4gICAgY29uc3QgbWVzc2FnZXMgPSBjaGVja0NvbW1vbkpTTW9kdWxlcyhtZXRhZmlsZSwgb3B0aW9ucy5hbGxvd2VkQ29tbW9uSnNEZXBlbmRlbmNpZXMpO1xuICAgIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIHsgd2FybmluZ3M6IG1lc3NhZ2VzIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEluZGV4IEhUTUwgY29udGVudCB3aXRob3V0IENTUyBpbmxpbmluZyB0byBiZSB1c2VkIGZvciBzZXJ2ZXIgcmVuZGVyaW5nIChBcHBTaGVsbCwgU1NHIGFuZCBTU1IpLlxuICAgKlxuICAgKiBOT1RFOiB3ZSBkb24ndCBwZXJmb3JtIGNyaXRpY2FsIENTUyBpbmxpbmluZyBhcyB0aGlzIHdpbGwgYmUgZG9uZSBkdXJpbmcgc2VydmVyIHJlbmRlcmluZy5cbiAgICovXG4gIGxldCBpbmRleENvbnRlbnRPdXRwdXROb0Nzc0lubGluaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cbiAgLy8gR2VuZXJhdGUgaW5kZXggSFRNTCBmaWxlXG4gIC8vIElmIGxvY2FsaXphdGlvbiBpcyBlbmFibGVkLCBpbmRleCBnZW5lcmF0aW9uIGlzIGhhbmRsZWQgaW4gdGhlIGlubGluaW5nIHByb2Nlc3MuXG4gIC8vIE5PVEU6IExvY2FsaXphdGlvbiB3aXRoIFNTUiBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZC5cbiAgaWYgKGluZGV4SHRtbE9wdGlvbnMgJiYgIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgY29uc3QgeyBjb250ZW50LCBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZCwgZXJyb3JzLCB3YXJuaW5ncyB9ID0gYXdhaXQgZ2VuZXJhdGVJbmRleEh0bWwoXG4gICAgICBpbml0aWFsRmlsZXMsXG4gICAgICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMsXG4gICAgICB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIG9wdGltaXphdGlvbk9wdGlvbnMsXG4gICAgICB9LFxuICAgICAgLy8gU2V0IGxhbmcgYXR0cmlidXRlIHRvIHRoZSBkZWZpbmVkIHNvdXJjZSBsb2NhbGUgaWYgcHJlc2VudFxuICAgICAgb3B0aW9ucy5pMThuT3B0aW9ucy5oYXNEZWZpbmVkU291cmNlTG9jYWxlID8gb3B0aW9ucy5pMThuT3B0aW9ucy5zb3VyY2VMb2NhbGUgOiB1bmRlZmluZWQsXG4gICAgKTtcblxuICAgIGluZGV4Q29udGVudE91dHB1dE5vQ3NzSW5saW5pbmcgPSBjb250ZW50V2l0aG91dENyaXRpY2FsQ3NzSW5saW5lZDtcbiAgICBwcmludFdhcm5pbmdzQW5kRXJyb3JzVG9Db25zb2xlKGNvbnRleHQsIHdhcm5pbmdzLCBlcnJvcnMpO1xuXG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoaW5kZXhIdG1sT3B0aW9ucy5vdXRwdXQsIGNvbnRlbnQsIEJ1aWxkT3V0cHV0RmlsZVR5cGUuQnJvd3Nlcik7XG5cbiAgICBpZiAoc3NyT3B0aW9ucykge1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoXG4gICAgICAgICdpbmRleC5zZXJ2ZXIuaHRtbCcsXG4gICAgICAgIGNvbnRlbnRXaXRob3V0Q3JpdGljYWxDc3NJbmxpbmVkLFxuICAgICAgICBCdWlsZE91dHB1dEZpbGVUeXBlLlNlcnZlcixcbiAgICAgICk7XG4gICAgfVxuICB9XG5cbiAgLy8gUHJlLXJlbmRlciAoU1NHKSBhbmQgQXBwLXNoZWxsXG4gIC8vIElmIGxvY2FsaXphdGlvbiBpcyBlbmFibGVkLCBwcmVyZW5kZXJpbmcgaXMgaGFuZGxlZCBpbiB0aGUgaW5saW5pbmcgcHJvY2Vzcy5cbiAgaWYgKChwcmVyZW5kZXJPcHRpb25zIHx8IGFwcFNoZWxsT3B0aW9ucykgJiYgIW9wdGlvbnMuaTE4bk9wdGlvbnMuc2hvdWxkSW5saW5lKSB7XG4gICAgYXNzZXJ0KFxuICAgICAgaW5kZXhDb250ZW50T3V0cHV0Tm9Dc3NJbmxpbmluZyxcbiAgICAgICdUaGUgXCJpbmRleFwiIG9wdGlvbiBpcyByZXF1aXJlZCB3aGVuIHVzaW5nIHRoZSBcInNzZ1wiIG9yIFwiYXBwU2hlbGxcIiBvcHRpb25zLicsXG4gICAgKTtcblxuICAgIGNvbnN0IHsgb3V0cHV0LCB3YXJuaW5ncywgZXJyb3JzIH0gPSBhd2FpdCBwcmVyZW5kZXJQYWdlcyhcbiAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICBhcHBTaGVsbE9wdGlvbnMsXG4gICAgICBwcmVyZW5kZXJPcHRpb25zLFxuICAgICAgZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzLFxuICAgICAgaW5kZXhDb250ZW50T3V0cHV0Tm9Dc3NJbmxpbmluZyxcbiAgICAgIG9wdGltaXphdGlvbk9wdGlvbnMuc3R5bGVzLmlubGluZUNyaXRpY2FsLFxuICAgICAgbWF4V29ya2VycyxcbiAgICAgIHZlcmJvc2UsXG4gICAgKTtcblxuICAgIHByaW50V2FybmluZ3NBbmRFcnJvcnNUb0NvbnNvbGUoY29udGV4dCwgd2FybmluZ3MsIGVycm9ycyk7XG5cbiAgICBmb3IgKGNvbnN0IFtwYXRoLCBjb250ZW50XSBvZiBPYmplY3QuZW50cmllcyhvdXRwdXQpKSB7XG4gICAgICBleGVjdXRpb25SZXN1bHQuYWRkT3V0cHV0RmlsZShwYXRoLCBjb250ZW50LCBCdWlsZE91dHB1dEZpbGVUeXBlLkJyb3dzZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICAvLyBUaGUgd2VicGFjayBjb3B5IGFzc2V0cyBoZWxwZXIgaXMgdXNlZCB3aXRoIG5vIGJhc2UgcGF0aHMgZGVmaW5lZC4gVGhpcyBwcmV2ZW50cyB0aGUgaGVscGVyXG4gICAgLy8gZnJvbSBkaXJlY3RseSB3cml0aW5nIHRvIGRpc2suIFRoaXMgc2hvdWxkIGV2ZW50dWFsbHkgYmUgcmVwbGFjZWQgd2l0aCBhIG1vcmUgb3B0aW1pemVkIGhlbHBlci5cbiAgICBleGVjdXRpb25SZXN1bHQuYWRkQXNzZXRzKGF3YWl0IGNvcHlBc3NldHMoYXNzZXRzLCBbXSwgd29ya3NwYWNlUm9vdCkpO1xuICB9XG5cbiAgLy8gRXh0cmFjdCBhbmQgd3JpdGUgbGljZW5zZXMgZm9yIHVzZWQgcGFja2FnZXNcbiAgaWYgKG9wdGlvbnMuZXh0cmFjdExpY2Vuc2VzKSB7XG4gICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoXG4gICAgICAnM3JkcGFydHlsaWNlbnNlcy50eHQnLFxuICAgICAgYXdhaXQgZXh0cmFjdExpY2Vuc2VzKG1ldGFmaWxlLCB3b3Jrc3BhY2VSb290KSxcbiAgICAgIEJ1aWxkT3V0cHV0RmlsZVR5cGUuUm9vdCxcbiAgICApO1xuICB9XG5cbiAgLy8gQXVnbWVudCB0aGUgYXBwbGljYXRpb24gd2l0aCBzZXJ2aWNlIHdvcmtlciBzdXBwb3J0XG4gIC8vIElmIGxvY2FsaXphdGlvbiBpcyBlbmFibGVkLCBzZXJ2aWNlIHdvcmtlciBpcyBoYW5kbGVkIGluIHRoZSBpbmxpbmluZyBwcm9jZXNzLlxuICBpZiAoc2VydmljZVdvcmtlciAmJiAhb3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2VydmljZVdvcmtlclJlc3VsdCA9IGF3YWl0IGF1Z21lbnRBcHBXaXRoU2VydmljZVdvcmtlckVzYnVpbGQoXG4gICAgICAgIHdvcmtzcGFjZVJvb3QsXG4gICAgICAgIHNlcnZpY2VXb3JrZXIsXG4gICAgICAgIG9wdGlvbnMuYmFzZUhyZWYgfHwgJy8nLFxuICAgICAgICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5hc3NldEZpbGVzLFxuICAgICAgKTtcbiAgICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKFxuICAgICAgICAnbmdzdy5qc29uJyxcbiAgICAgICAgc2VydmljZVdvcmtlclJlc3VsdC5tYW5pZmVzdCxcbiAgICAgICAgQnVpbGRPdXRwdXRGaWxlVHlwZS5Ccm93c2VyLFxuICAgICAgKTtcbiAgICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRBc3NldHMoc2VydmljZVdvcmtlclJlc3VsdC5hc3NldEZpbGVzKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBgJHtlcnJvcn1gKTtcblxuICAgICAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbiAgICB9XG4gIH1cblxuICAvLyBBbmFseXplIGZpbGVzIGZvciBidW5kbGUgYnVkZ2V0IGZhaWx1cmVzIGlmIHByZXNlbnRcbiAgbGV0IGJ1ZGdldEZhaWx1cmVzO1xuICBpZiAob3B0aW9ucy5idWRnZXRzKSB7XG4gICAgY29uc3QgY29tcGF0U3RhdHMgPSBnZW5lcmF0ZUJ1ZGdldFN0YXRzKG1ldGFmaWxlLCBpbml0aWFsRmlsZXMpO1xuICAgIGJ1ZGdldEZhaWx1cmVzID0gWy4uLmNoZWNrQnVkZ2V0cyhvcHRpb25zLmJ1ZGdldHMsIGNvbXBhdFN0YXRzLCB0cnVlKV07XG4gICAgZm9yIChjb25zdCB7IHNldmVyaXR5LCBtZXNzYWdlIH0gb2YgYnVkZ2V0RmFpbHVyZXMpIHtcbiAgICAgIGlmIChzZXZlcml0eSA9PT0gJ2Vycm9yJykge1xuICAgICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihtZXNzYWdlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnRleHQubG9nZ2VyLndhcm4obWVzc2FnZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gQ2FsY3VsYXRlIGVzdGltYXRlZCB0cmFuc2ZlciBzaXplIGlmIHNjcmlwdHMgYXJlIG9wdGltaXplZFxuICBsZXQgZXN0aW1hdGVkVHJhbnNmZXJTaXplcztcbiAgaWYgKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cyB8fCBvcHRpbWl6YXRpb25PcHRpb25zLnN0eWxlcy5taW5pZnkpIHtcbiAgICBlc3RpbWF0ZWRUcmFuc2ZlclNpemVzID0gYXdhaXQgY2FsY3VsYXRlRXN0aW1hdGVkVHJhbnNmZXJTaXplcyhleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMpO1xuICB9XG5cbiAgbG9nQnVpbGRTdGF0cyhjb250ZXh0LCBtZXRhZmlsZSwgaW5pdGlhbEZpbGVzLCBidWRnZXRGYWlsdXJlcywgZXN0aW1hdGVkVHJhbnNmZXJTaXplcyk7XG5cbiAgY29uc3QgYnVpbGRUaW1lID0gTnVtYmVyKHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpIC0gc3RhcnRUaW1lKSAvIDEwICoqIDk7XG4gIGNvbnRleHQubG9nZ2VyLmluZm8oYEFwcGxpY2F0aW9uIGJ1bmRsZSBnZW5lcmF0aW9uIGNvbXBsZXRlLiBbJHtidWlsZFRpbWUudG9GaXhlZCgzKX0gc2Vjb25kc11gKTtcblxuICAvLyBQZXJmb3JtIGkxOG4gdHJhbnNsYXRpb24gaW5saW5pbmcgaWYgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5pMThuT3B0aW9ucy5zaG91bGRJbmxpbmUpIHtcbiAgICBjb25zdCB7IGVycm9ycywgd2FybmluZ3MgfSA9IGF3YWl0IGlubGluZUkxOG4ob3B0aW9ucywgZXhlY3V0aW9uUmVzdWx0LCBpbml0aWFsRmlsZXMpO1xuICAgIHByaW50V2FybmluZ3NBbmRFcnJvcnNUb0NvbnNvbGUoY29udGV4dCwgd2FybmluZ3MsIGVycm9ycyk7XG4gIH1cblxuICAvLyBXcml0ZSBtZXRhZmlsZSBpZiBzdGF0cyBvcHRpb24gaXMgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5zdGF0cykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKFxuICAgICAgJ3N0YXRzLmpzb24nLFxuICAgICAgSlNPTi5zdHJpbmdpZnkobWV0YWZpbGUsIG51bGwsIDIpLFxuICAgICAgQnVpbGRPdXRwdXRGaWxlVHlwZS5Sb290LFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xufVxuXG5mdW5jdGlvbiBwcmludFdhcm5pbmdzQW5kRXJyb3JzVG9Db25zb2xlKFxuICBjb250ZXh0OiBCdWlsZGVyQ29udGV4dCxcbiAgd2FybmluZ3M6IHN0cmluZ1tdLFxuICBlcnJvcnM6IHN0cmluZ1tdLFxuKTogdm9pZCB7XG4gIGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG4gICAgY29udGV4dC5sb2dnZXIuZXJyb3IoZXJyb3IpO1xuICB9XG4gIGZvciAoY29uc3Qgd2FybmluZyBvZiB3YXJuaW5ncykge1xuICAgIGNvbnRleHQubG9nZ2VyLndhcm4od2FybmluZyk7XG4gIH1cbn1cbiJdfQ==