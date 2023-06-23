"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeBuild = void 0;
const compiler_plugin_1 = require("../../tools/esbuild/angular/compiler-plugin");
const application_code_bundle_1 = require("../../tools/esbuild/application-code-bundle");
const bundler_context_1 = require("../../tools/esbuild/bundler-context");
const bundler_execution_result_1 = require("../../tools/esbuild/bundler-execution-result");
const commonjs_checker_1 = require("../../tools/esbuild/commonjs-checker");
const global_scripts_1 = require("../../tools/esbuild/global-scripts");
const global_styles_1 = require("../../tools/esbuild/global-styles");
const index_html_generator_1 = require("../../tools/esbuild/index-html-generator");
const license_extractor_1 = require("../../tools/esbuild/license-extractor");
const utils_1 = require("../../tools/esbuild/utils");
const copy_assets_1 = require("../../utils/copy-assets");
const service_worker_1 = require("../../utils/service-worker");
const supported_browsers_1 = require("../../utils/supported-browsers");
async function executeBuild(options, context, rebuildState) {
    const startTime = process.hrtime.bigint();
    const { projectRoot, workspaceRoot, serviceWorker, optimizationOptions, assets, indexHtmlOptions, cacheOptions, } = options;
    const browsers = (0, supported_browsers_1.getSupportedBrowsers)(projectRoot, context.logger);
    const target = (0, utils_1.transformSupportedBrowsersToTargets)(browsers);
    // Reuse rebuild state or create new bundle contexts for code and global stylesheets
    let bundlerContexts = rebuildState?.rebuildContexts;
    const codeBundleCache = rebuildState?.codeBundleCache ??
        new compiler_plugin_1.SourceFileCache(cacheOptions.enabled ? cacheOptions.path : undefined);
    if (bundlerContexts === undefined) {
        bundlerContexts = [];
        // Application code
        bundlerContexts.push(new bundler_context_1.BundlerContext(workspaceRoot, !!options.watch, (0, application_code_bundle_1.createCodeBundleOptions)(options, target, browsers, codeBundleCache)));
        // Global Stylesheets
        if (options.globalStyles.length > 0) {
            for (const initial of [true, false]) {
                const bundleOptions = (0, global_styles_1.createGlobalStylesBundleOptions)(options, target, browsers, initial, codeBundleCache?.loadResultCache);
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
    // Generate index HTML file
    if (indexHtmlOptions) {
        const { errors, warnings, content } = await (0, index_html_generator_1.generateIndexHtml)(initialFiles, executionResult, options);
        for (const error of errors) {
            context.logger.error(error);
        }
        for (const warning of warnings) {
            context.logger.warn(warning);
        }
        executionResult.addOutputFile(indexHtmlOptions.output, content);
    }
    // Copy assets
    if (assets) {
        // The webpack copy assets helper is used with no base paths defined. This prevents the helper
        // from directly writing to disk. This should eventually be replaced with a more optimized helper.
        executionResult.assetFiles.push(...(await (0, copy_assets_1.copyAssets)(assets, [], workspaceRoot)));
    }
    // Write metafile if stats option is enabled
    if (options.stats) {
        executionResult.addOutputFile('stats.json', JSON.stringify(metafile, null, 2));
    }
    // Extract and write licenses for used packages
    if (options.extractLicenses) {
        executionResult.addOutputFile('3rdpartylicenses.txt', await (0, license_extractor_1.extractLicenses)(metafile, workspaceRoot));
    }
    // Augment the application with service worker support
    if (serviceWorker) {
        try {
            const serviceWorkerResult = await (0, service_worker_1.augmentAppWithServiceWorkerEsbuild)(workspaceRoot, serviceWorker, options.baseHref || '/', executionResult.outputFiles, executionResult.assetFiles);
            executionResult.addOutputFile('ngsw.json', serviceWorkerResult.manifest);
            executionResult.assetFiles.push(...serviceWorkerResult.assetFiles);
        }
        catch (error) {
            context.logger.error(error instanceof Error ? error.message : `${error}`);
            return executionResult;
        }
    }
    // Calculate estimated transfer size if scripts are optimized
    let estimatedTransferSizes;
    if (optimizationOptions.scripts || optimizationOptions.styles.minify) {
        estimatedTransferSizes = await (0, utils_1.calculateEstimatedTransferSizes)(executionResult.outputFiles);
    }
    (0, utils_1.logBuildStats)(context, metafile, initialFiles, estimatedTransferSizes);
    const buildTime = Number(process.hrtime.bigint() - startTime) / 10 ** 9;
    context.logger.info(`Application bundle generation complete. [${buildTime.toFixed(3)} seconds]`);
    return executionResult;
}
exports.executeBuild = executeBuild;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhlY3V0ZS1idWlsZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL2J1aWxkZXJzL2FwcGxpY2F0aW9uL2V4ZWN1dGUtYnVpbGQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7Ozs7R0FNRzs7O0FBR0gsaUZBQThFO0FBQzlFLHlGQUFzRjtBQUN0Rix5RUFBcUU7QUFDckUsMkZBQTZGO0FBQzdGLDJFQUE0RTtBQUM1RSx1RUFBc0Y7QUFDdEYscUVBQW9GO0FBQ3BGLG1GQUE2RTtBQUM3RSw2RUFBd0U7QUFDeEUscURBS21DO0FBQ25DLHlEQUFxRDtBQUNyRCwrREFBZ0Y7QUFDaEYsdUVBQXNFO0FBRy9ELEtBQUssVUFBVSxZQUFZLENBQ2hDLE9BQTBDLEVBQzFDLE9BQXVCLEVBQ3ZCLFlBQTJCO0lBRTNCLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUM7SUFFMUMsTUFBTSxFQUNKLFdBQVcsRUFDWCxhQUFhLEVBQ2IsYUFBYSxFQUNiLG1CQUFtQixFQUNuQixNQUFNLEVBQ04sZ0JBQWdCLEVBQ2hCLFlBQVksR0FDYixHQUFHLE9BQU8sQ0FBQztJQUVaLE1BQU0sUUFBUSxHQUFHLElBQUEseUNBQW9CLEVBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUNuRSxNQUFNLE1BQU0sR0FBRyxJQUFBLDJDQUFtQyxFQUFDLFFBQVEsQ0FBQyxDQUFDO0lBRTdELG9GQUFvRjtJQUNwRixJQUFJLGVBQWUsR0FBRyxZQUFZLEVBQUUsZUFBZSxDQUFDO0lBQ3BELE1BQU0sZUFBZSxHQUNuQixZQUFZLEVBQUUsZUFBZTtRQUM3QixJQUFJLGlDQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLENB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LENBQUMsR0FBRyxtQkFBbUIsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNwRTtRQUFDLE9BQU8sS0FBSyxFQUFFO1lBQ2QsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsR0FBRyxLQUFLLEVBQUUsQ0FBQyxDQUFDO1lBRTFFLE9BQU8sZUFBZSxDQUFDO1NBQ3hCO0tBQ0Y7SUFFRCw2REFBNkQ7SUFDN0QsSUFBSSxzQkFBc0IsQ0FBQztJQUMzQixJQUFJLG1CQUFtQixDQUFDLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO1FBQ3BFLHNCQUFzQixHQUFHLE1BQU0sSUFBQSx1Q0FBK0IsRUFBQyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDN0Y7SUFDRCxJQUFBLHFCQUFhLEVBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsc0JBQXNCLENBQUMsQ0FBQztJQUV2RSxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsR0FBRyxTQUFTLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQ3hFLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLDRDQUE0QyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUVqRyxPQUFPLGVBQWUsQ0FBQztBQUN6QixDQUFDO0FBN0pELG9DQTZKQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBCdWlsZGVyQ29udGV4dCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3QnO1xuaW1wb3J0IHsgU291cmNlRmlsZUNhY2hlIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9hbmd1bGFyL2NvbXBpbGVyLXBsdWdpbic7XG5pbXBvcnQgeyBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYXBwbGljYXRpb24tY29kZS1idW5kbGUnO1xuaW1wb3J0IHsgQnVuZGxlckNvbnRleHQgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2J1bmRsZXItY29udGV4dCc7XG5pbXBvcnQgeyBFeGVjdXRpb25SZXN1bHQsIFJlYnVpbGRTdGF0ZSB9IGZyb20gJy4uLy4uL3Rvb2xzL2VzYnVpbGQvYnVuZGxlci1leGVjdXRpb24tcmVzdWx0JztcbmltcG9ydCB7IGNoZWNrQ29tbW9uSlNNb2R1bGVzIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9jb21tb25qcy1jaGVja2VyJztcbmltcG9ydCB7IGNyZWF0ZUdsb2JhbFNjcmlwdHNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9nbG9iYWwtc2NyaXB0cyc7XG5pbXBvcnQgeyBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9nbG9iYWwtc3R5bGVzJztcbmltcG9ydCB7IGdlbmVyYXRlSW5kZXhIdG1sIH0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC9pbmRleC1odG1sLWdlbmVyYXRvcic7XG5pbXBvcnQgeyBleHRyYWN0TGljZW5zZXMgfSBmcm9tICcuLi8uLi90b29scy9lc2J1aWxkL2xpY2Vuc2UtZXh0cmFjdG9yJztcbmltcG9ydCB7XG4gIGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMsXG4gIGxvZ0J1aWxkU3RhdHMsXG4gIGxvZ01lc3NhZ2VzLFxuICB0cmFuc2Zvcm1TdXBwb3J0ZWRCcm93c2Vyc1RvVGFyZ2V0cyxcbn0gZnJvbSAnLi4vLi4vdG9vbHMvZXNidWlsZC91dGlscyc7XG5pbXBvcnQgeyBjb3B5QXNzZXRzIH0gZnJvbSAnLi4vLi4vdXRpbHMvY29weS1hc3NldHMnO1xuaW1wb3J0IHsgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZCB9IGZyb20gJy4uLy4uL3V0aWxzL3NlcnZpY2Utd29ya2VyJztcbmltcG9ydCB7IGdldFN1cHBvcnRlZEJyb3dzZXJzIH0gZnJvbSAnLi4vLi4vdXRpbHMvc3VwcG9ydGVkLWJyb3dzZXJzJztcbmltcG9ydCB7IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyB9IGZyb20gJy4vb3B0aW9ucyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBleGVjdXRlQnVpbGQoXG4gIG9wdGlvbnM6IE5vcm1hbGl6ZWRBcHBsaWNhdGlvbkJ1aWxkT3B0aW9ucyxcbiAgY29udGV4dDogQnVpbGRlckNvbnRleHQsXG4gIHJlYnVpbGRTdGF0ZT86IFJlYnVpbGRTdGF0ZSxcbik6IFByb21pc2U8RXhlY3V0aW9uUmVzdWx0PiB7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IHByb2Nlc3MuaHJ0aW1lLmJpZ2ludCgpO1xuXG4gIGNvbnN0IHtcbiAgICBwcm9qZWN0Um9vdCxcbiAgICB3b3Jrc3BhY2VSb290LFxuICAgIHNlcnZpY2VXb3JrZXIsXG4gICAgb3B0aW1pemF0aW9uT3B0aW9ucyxcbiAgICBhc3NldHMsXG4gICAgaW5kZXhIdG1sT3B0aW9ucyxcbiAgICBjYWNoZU9wdGlvbnMsXG4gIH0gPSBvcHRpb25zO1xuXG4gIGNvbnN0IGJyb3dzZXJzID0gZ2V0U3VwcG9ydGVkQnJvd3NlcnMocHJvamVjdFJvb3QsIGNvbnRleHQubG9nZ2VyKTtcbiAgY29uc3QgdGFyZ2V0ID0gdHJhbnNmb3JtU3VwcG9ydGVkQnJvd3NlcnNUb1RhcmdldHMoYnJvd3NlcnMpO1xuXG4gIC8vIFJldXNlIHJlYnVpbGQgc3RhdGUgb3IgY3JlYXRlIG5ldyBidW5kbGUgY29udGV4dHMgZm9yIGNvZGUgYW5kIGdsb2JhbCBzdHlsZXNoZWV0c1xuICBsZXQgYnVuZGxlckNvbnRleHRzID0gcmVidWlsZFN0YXRlPy5yZWJ1aWxkQ29udGV4dHM7XG4gIGNvbnN0IGNvZGVCdW5kbGVDYWNoZSA9XG4gICAgcmVidWlsZFN0YXRlPy5jb2RlQnVuZGxlQ2FjaGUgPz9cbiAgICBuZXcgU291cmNlRmlsZUNhY2hlKGNhY2hlT3B0aW9ucy5lbmFibGVkID8gY2FjaGVPcHRpb25zLnBhdGggOiB1bmRlZmluZWQpO1xuICBpZiAoYnVuZGxlckNvbnRleHRzID09PSB1bmRlZmluZWQpIHtcbiAgICBidW5kbGVyQ29udGV4dHMgPSBbXTtcblxuICAgIC8vIEFwcGxpY2F0aW9uIGNvZGVcbiAgICBidW5kbGVyQ29udGV4dHMucHVzaChcbiAgICAgIG5ldyBCdW5kbGVyQ29udGV4dChcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgISFvcHRpb25zLndhdGNoLFxuICAgICAgICBjcmVhdGVDb2RlQnVuZGxlT3B0aW9ucyhvcHRpb25zLCB0YXJnZXQsIGJyb3dzZXJzLCBjb2RlQnVuZGxlQ2FjaGUpLFxuICAgICAgKSxcbiAgICApO1xuXG4gICAgLy8gR2xvYmFsIFN0eWxlc2hlZXRzXG4gICAgaWYgKG9wdGlvbnMuZ2xvYmFsU3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3QgaW5pdGlhbCBvZiBbdHJ1ZSwgZmFsc2VdKSB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU9wdGlvbnMgPSBjcmVhdGVHbG9iYWxTdHlsZXNCdW5kbGVPcHRpb25zKFxuICAgICAgICAgIG9wdGlvbnMsXG4gICAgICAgICAgdGFyZ2V0LFxuICAgICAgICAgIGJyb3dzZXJzLFxuICAgICAgICAgIGluaXRpYWwsXG4gICAgICAgICAgY29kZUJ1bmRsZUNhY2hlPy5sb2FkUmVzdWx0Q2FjaGUsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChidW5kbGVPcHRpb25zKSB7XG4gICAgICAgICAgYnVuZGxlckNvbnRleHRzLnB1c2goXG4gICAgICAgICAgICBuZXcgQnVuZGxlckNvbnRleHQod29ya3NwYWNlUm9vdCwgISFvcHRpb25zLndhdGNoLCBidW5kbGVPcHRpb25zLCAoKSA9PiBpbml0aWFsKSxcbiAgICAgICAgICApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR2xvYmFsIFNjcmlwdHNcbiAgICBpZiAob3B0aW9ucy5nbG9iYWxTY3JpcHRzLmxlbmd0aCA+IDApIHtcbiAgICAgIGZvciAoY29uc3QgaW5pdGlhbCBvZiBbdHJ1ZSwgZmFsc2VdKSB7XG4gICAgICAgIGNvbnN0IGJ1bmRsZU9wdGlvbnMgPSBjcmVhdGVHbG9iYWxTY3JpcHRzQnVuZGxlT3B0aW9ucyhvcHRpb25zLCBpbml0aWFsKTtcbiAgICAgICAgaWYgKGJ1bmRsZU9wdGlvbnMpIHtcbiAgICAgICAgICBidW5kbGVyQ29udGV4dHMucHVzaChcbiAgICAgICAgICAgIG5ldyBCdW5kbGVyQ29udGV4dCh3b3Jrc3BhY2VSb290LCAhIW9wdGlvbnMud2F0Y2gsIGJ1bmRsZU9wdGlvbnMsICgpID0+IGluaXRpYWwpLFxuICAgICAgICAgICk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBjb25zdCBidW5kbGluZ1Jlc3VsdCA9IGF3YWl0IEJ1bmRsZXJDb250ZXh0LmJ1bmRsZUFsbChidW5kbGVyQ29udGV4dHMpO1xuXG4gIC8vIExvZyBhbGwgd2FybmluZ3MgYW5kIGVycm9ycyBnZW5lcmF0ZWQgZHVyaW5nIGJ1bmRsaW5nXG4gIGF3YWl0IGxvZ01lc3NhZ2VzKGNvbnRleHQsIGJ1bmRsaW5nUmVzdWx0KTtcblxuICBjb25zdCBleGVjdXRpb25SZXN1bHQgPSBuZXcgRXhlY3V0aW9uUmVzdWx0KGJ1bmRsZXJDb250ZXh0cywgY29kZUJ1bmRsZUNhY2hlKTtcblxuICAvLyBSZXR1cm4gaWYgdGhlIGJ1bmRsaW5nIGhhcyBlcnJvcnNcbiAgaWYgKGJ1bmRsaW5nUmVzdWx0LmVycm9ycykge1xuICAgIHJldHVybiBleGVjdXRpb25SZXN1bHQ7XG4gIH1cblxuICBjb25zdCB7IG1ldGFmaWxlLCBpbml0aWFsRmlsZXMsIG91dHB1dEZpbGVzIH0gPSBidW5kbGluZ1Jlc3VsdDtcblxuICBleGVjdXRpb25SZXN1bHQub3V0cHV0RmlsZXMucHVzaCguLi5vdXRwdXRGaWxlcyk7XG5cbiAgLy8gQ2hlY2sgbWV0YWZpbGUgZm9yIENvbW1vbkpTIG1vZHVsZSB1c2FnZSBpZiBvcHRpbWl6aW5nIHNjcmlwdHNcbiAgaWYgKG9wdGltaXphdGlvbk9wdGlvbnMuc2NyaXB0cykge1xuICAgIGNvbnN0IG1lc3NhZ2VzID0gY2hlY2tDb21tb25KU01vZHVsZXMobWV0YWZpbGUsIG9wdGlvbnMuYWxsb3dlZENvbW1vbkpzRGVwZW5kZW5jaWVzKTtcbiAgICBhd2FpdCBsb2dNZXNzYWdlcyhjb250ZXh0LCB7IHdhcm5pbmdzOiBtZXNzYWdlcyB9KTtcbiAgfVxuXG4gIC8vIEdlbmVyYXRlIGluZGV4IEhUTUwgZmlsZVxuICBpZiAoaW5kZXhIdG1sT3B0aW9ucykge1xuICAgIGNvbnN0IHsgZXJyb3JzLCB3YXJuaW5ncywgY29udGVudCB9ID0gYXdhaXQgZ2VuZXJhdGVJbmRleEh0bWwoXG4gICAgICBpbml0aWFsRmlsZXMsXG4gICAgICBleGVjdXRpb25SZXN1bHQsXG4gICAgICBvcHRpb25zLFxuICAgICk7XG4gICAgZm9yIChjb25zdCBlcnJvciBvZiBlcnJvcnMpIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmVycm9yKGVycm9yKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCB3YXJuaW5nIG9mIHdhcm5pbmdzKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci53YXJuKHdhcm5pbmcpO1xuICAgIH1cblxuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKGluZGV4SHRtbE9wdGlvbnMub3V0cHV0LCBjb250ZW50KTtcbiAgfVxuXG4gIC8vIENvcHkgYXNzZXRzXG4gIGlmIChhc3NldHMpIHtcbiAgICAvLyBUaGUgd2VicGFjayBjb3B5IGFzc2V0cyBoZWxwZXIgaXMgdXNlZCB3aXRoIG5vIGJhc2UgcGF0aHMgZGVmaW5lZC4gVGhpcyBwcmV2ZW50cyB0aGUgaGVscGVyXG4gICAgLy8gZnJvbSBkaXJlY3RseSB3cml0aW5nIHRvIGRpc2suIFRoaXMgc2hvdWxkIGV2ZW50dWFsbHkgYmUgcmVwbGFjZWQgd2l0aCBhIG1vcmUgb3B0aW1pemVkIGhlbHBlci5cbiAgICBleGVjdXRpb25SZXN1bHQuYXNzZXRGaWxlcy5wdXNoKC4uLihhd2FpdCBjb3B5QXNzZXRzKGFzc2V0cywgW10sIHdvcmtzcGFjZVJvb3QpKSk7XG4gIH1cblxuICAvLyBXcml0ZSBtZXRhZmlsZSBpZiBzdGF0cyBvcHRpb24gaXMgZW5hYmxlZFxuICBpZiAob3B0aW9ucy5zdGF0cykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKCdzdGF0cy5qc29uJywgSlNPTi5zdHJpbmdpZnkobWV0YWZpbGUsIG51bGwsIDIpKTtcbiAgfVxuXG4gIC8vIEV4dHJhY3QgYW5kIHdyaXRlIGxpY2Vuc2VzIGZvciB1c2VkIHBhY2thZ2VzXG4gIGlmIChvcHRpb25zLmV4dHJhY3RMaWNlbnNlcykge1xuICAgIGV4ZWN1dGlvblJlc3VsdC5hZGRPdXRwdXRGaWxlKFxuICAgICAgJzNyZHBhcnR5bGljZW5zZXMudHh0JyxcbiAgICAgIGF3YWl0IGV4dHJhY3RMaWNlbnNlcyhtZXRhZmlsZSwgd29ya3NwYWNlUm9vdCksXG4gICAgKTtcbiAgfVxuXG4gIC8vIEF1Z21lbnQgdGhlIGFwcGxpY2F0aW9uIHdpdGggc2VydmljZSB3b3JrZXIgc3VwcG9ydFxuICBpZiAoc2VydmljZVdvcmtlcikge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZXJ2aWNlV29ya2VyUmVzdWx0ID0gYXdhaXQgYXVnbWVudEFwcFdpdGhTZXJ2aWNlV29ya2VyRXNidWlsZChcbiAgICAgICAgd29ya3NwYWNlUm9vdCxcbiAgICAgICAgc2VydmljZVdvcmtlcixcbiAgICAgICAgb3B0aW9ucy5iYXNlSHJlZiB8fCAnLycsXG4gICAgICAgIGV4ZWN1dGlvblJlc3VsdC5vdXRwdXRGaWxlcyxcbiAgICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMsXG4gICAgICApO1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFkZE91dHB1dEZpbGUoJ25nc3cuanNvbicsIHNlcnZpY2VXb3JrZXJSZXN1bHQubWFuaWZlc3QpO1xuICAgICAgZXhlY3V0aW9uUmVzdWx0LmFzc2V0RmlsZXMucHVzaCguLi5zZXJ2aWNlV29ya2VyUmVzdWx0LmFzc2V0RmlsZXMpO1xuICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5lcnJvcihlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IGAke2Vycm9yfWApO1xuXG4gICAgICByZXR1cm4gZXhlY3V0aW9uUmVzdWx0O1xuICAgIH1cbiAgfVxuXG4gIC8vIENhbGN1bGF0ZSBlc3RpbWF0ZWQgdHJhbnNmZXIgc2l6ZSBpZiBzY3JpcHRzIGFyZSBvcHRpbWl6ZWRcbiAgbGV0IGVzdGltYXRlZFRyYW5zZmVyU2l6ZXM7XG4gIGlmIChvcHRpbWl6YXRpb25PcHRpb25zLnNjcmlwdHMgfHwgb3B0aW1pemF0aW9uT3B0aW9ucy5zdHlsZXMubWluaWZ5KSB7XG4gICAgZXN0aW1hdGVkVHJhbnNmZXJTaXplcyA9IGF3YWl0IGNhbGN1bGF0ZUVzdGltYXRlZFRyYW5zZmVyU2l6ZXMoZXhlY3V0aW9uUmVzdWx0Lm91dHB1dEZpbGVzKTtcbiAgfVxuICBsb2dCdWlsZFN0YXRzKGNvbnRleHQsIG1ldGFmaWxlLCBpbml0aWFsRmlsZXMsIGVzdGltYXRlZFRyYW5zZmVyU2l6ZXMpO1xuXG4gIGNvbnN0IGJ1aWxkVGltZSA9IE51bWJlcihwcm9jZXNzLmhydGltZS5iaWdpbnQoKSAtIHN0YXJ0VGltZSkgLyAxMCAqKiA5O1xuICBjb250ZXh0LmxvZ2dlci5pbmZvKGBBcHBsaWNhdGlvbiBidW5kbGUgZ2VuZXJhdGlvbiBjb21wbGV0ZS4gWyR7YnVpbGRUaW1lLnRvRml4ZWQoMyl9IHNlY29uZHNdYCk7XG5cbiAgcmV0dXJuIGV4ZWN1dGlvblJlc3VsdDtcbn1cbiJdfQ==