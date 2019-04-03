"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const architect_1 = require("@angular-devkit/architect");
const build_webpack_1 = require("@angular-devkit/build-webpack");
const path = require("path");
const webpack = require("webpack");
const webpack_configs_1 = require("../angular-cli-files/models/webpack-configs");
const webpack_browser_config_1 = require("../utils/webpack-browser-config");
function getI18nOutfile(format) {
    switch (format) {
        case 'xmb':
            return 'messages.xmb';
        case 'xlf':
        case 'xlif':
        case 'xliff':
        case 'xlf2':
        case 'xliff2':
            return 'messages.xlf';
        default:
            throw new Error(`Unsupported format "${format}"`);
    }
}
class InMemoryOutputPlugin {
    apply(compiler) {
        // tslint:disable-next-line:no-any
        compiler.outputFileSystem = new webpack.MemoryOutputFileSystem();
    }
}
async function execute(options, context) {
    const browserTarget = architect_1.targetFromTargetString(options.browserTarget);
    const browserOptions = await context.validateOptions(await context.getTargetOptions(browserTarget), await context.getBuilderNameForTarget(browserTarget));
    // We need to determine the outFile name so that AngularCompiler can retrieve it.
    let outFile = options.outFile || getI18nOutfile(options.i18nFormat);
    if (options.outputPath) {
        // AngularCompilerPlugin doesn't support genDir so we have to adjust outFile instead.
        outFile = path.join(options.outputPath, outFile);
    }
    const { config } = await webpack_browser_config_1.generateBrowserWebpackConfigFromContext(Object.assign({}, browserOptions, { optimization: {
            scripts: false,
            styles: false,
        }, i18nLocale: options.i18nLocale, i18nFormat: options.i18nFormat, i18nFile: outFile, aot: true, progress: options.progress, assets: [], scripts: [], styles: [], deleteOutputPath: false }), context, wco => [
        { plugins: [new InMemoryOutputPlugin()] },
        webpack_configs_1.getCommonConfig(wco),
        webpack_configs_1.getAotConfig(wco, true),
        webpack_configs_1.getStylesConfig(wco),
        webpack_configs_1.getStatsConfig(wco),
    ]);
    return build_webpack_1.runWebpack(config, context).toPromise();
}
exports.default = architect_1.createBuilder(execute);
