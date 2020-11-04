"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webpackStatsLogger = exports.createWebpackLoggingCallback = exports.statsHasWarnings = exports.statsHasErrors = exports.statsErrorsToString = exports.statsWarningsToString = exports.generateBundleStats = exports.formatSize = void 0;
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
// tslint:disable
// TODO: cleanup this file, it's copied as is from Angular CLI.
const core_1 = require("@angular-devkit/core");
const path = require("path");
const textTable = require("text-table");
const color_1 = require("../../utils/color");
function formatSize(size) {
    if (size <= 0) {
        return '0 bytes';
    }
    const abbreviations = ['bytes', 'kB', 'MB', 'GB'];
    const index = Math.floor(Math.log(size) / Math.log(1024));
    const roundedSize = size / Math.pow(1024, index);
    // bytes don't have a fraction
    const fractionDigits = index === 0 ? 0 : 2;
    return `${roundedSize.toFixed(fractionDigits)} ${abbreviations[index]}`;
}
exports.formatSize = formatSize;
;
function generateBundleStats(info, colors) {
    var _a;
    const size = typeof info.size === 'number' ? info.size : '-';
    const files = info.files.filter(f => !f.endsWith('.map')).map(f => path.basename(f)).join(', ');
    const names = ((_a = info.names) === null || _a === void 0 ? void 0 : _a.length) ? info.names.join(', ') : '-';
    const initial = !!(info.entry || info.initial);
    return {
        initial,
        stats: [files, names, size],
    };
}
exports.generateBundleStats = generateBundleStats;
function generateBuildStatsTable(data, colors, showTotalSize) {
    const g = (x) => colors ? color_1.colors.greenBright(x) : x;
    const c = (x) => colors ? color_1.colors.cyanBright(x) : x;
    const bold = (x) => colors ? color_1.colors.bold(x) : x;
    const dim = (x) => colors ? color_1.colors.dim(x) : x;
    const changedEntryChunksStats = [];
    const changedLazyChunksStats = [];
    let initialTotalSize = 0;
    for (const { initial, stats } of data) {
        const [files, names, size] = stats;
        const data = [
            g(files),
            names,
            c(typeof size === 'number' ? formatSize(size) : size),
        ];
        if (initial) {
            changedEntryChunksStats.push(data);
            if (typeof size === 'number') {
                initialTotalSize += size;
            }
        }
        else {
            changedLazyChunksStats.push(data);
        }
    }
    const bundleInfo = [];
    // Entry chunks
    if (changedEntryChunksStats.length) {
        bundleInfo.push(['Initial Chunk Files', 'Names', 'Size'].map(bold), ...changedEntryChunksStats);
        if (showTotalSize) {
            bundleInfo.push([]);
            bundleInfo.push([' ', 'Initial Total', formatSize(initialTotalSize)].map(bold));
        }
    }
    // Seperator
    if (changedEntryChunksStats.length && changedLazyChunksStats.length) {
        bundleInfo.push([]);
    }
    // Lazy chunks
    if (changedLazyChunksStats.length) {
        bundleInfo.push(['Lazy Chunk Files', 'Names', 'Size'].map(bold), ...changedLazyChunksStats);
    }
    return textTable(bundleInfo, {
        hsep: dim(' | '),
        stringLength: s => color_1.removeColor(s).length,
        align: ['l', 'l', 'r'],
    });
}
function generateBuildStats(hash, time, colors) {
    const w = (x) => colors ? color_1.colors.bold.white(x) : x;
    return `Build at: ${w(new Date().toISOString())} - Hash: ${w(hash)} - Time: ${w('' + time)}ms`;
}
function statsToString(json, statsConfig, bundleState) {
    const colors = statsConfig.colors;
    const rs = (x) => colors ? color_1.colors.reset(x) : x;
    const changedChunksStats = bundleState !== null && bundleState !== void 0 ? bundleState : [];
    let unchangedChunkNumber = 0;
    if (!(bundleState === null || bundleState === void 0 ? void 0 : bundleState.length)) {
        for (const chunk of json.chunks) {
            if (!chunk.rendered) {
                continue;
            }
            const assets = json.assets.filter((asset) => chunk.files.includes(asset.name));
            const summedSize = assets.filter((asset) => !asset.name.endsWith(".map")).reduce((total, asset) => { return total + asset.size; }, 0);
            changedChunksStats.push(generateBundleStats({ ...chunk, size: summedSize }, colors));
        }
        unchangedChunkNumber = json.chunks.length - changedChunksStats.length;
    }
    // Sort chunks by size in descending order
    changedChunksStats.sort((a, b) => {
        if (a.stats[2] > b.stats[2]) {
            return -1;
        }
        if (a.stats[2] < b.stats[2]) {
            return 1;
        }
        return 0;
    });
    const statsTable = generateBuildStatsTable(changedChunksStats, colors, unchangedChunkNumber === 0);
    // In some cases we do things outside of webpack context 
    // Such us index generation, service worker augmentation etc...
    // This will correct the time and include these.
    const time = (Date.now() - json.builtAt) + json.time;
    if (unchangedChunkNumber > 0) {
        return '\n' + rs(core_1.tags.stripIndents `
      ${statsTable}

      ${unchangedChunkNumber} unchanged chunks

      ${generateBuildStats(json.hash, time, colors)}
      `);
    }
    else {
        return '\n' + rs(core_1.tags.stripIndents `
      ${statsTable}

      ${generateBuildStats(json.hash, time, colors)}
      `);
    }
}
const ERRONEOUS_WARNINGS_FILTER = (warning) => ![
    // Webpack 5+ has no facility to disable this warning.
    // System.import is used in @angular/core for deprecated string-form lazy routes
    /System.import\(\) is deprecated and will be removed soon/i,
].some(msg => msg.test(warning));
function statsWarningsToString(json, statsConfig) {
    const colors = statsConfig.colors;
    const c = (x) => colors ? color_1.colors.reset.cyan(x) : x;
    const y = (x) => colors ? color_1.colors.reset.yellow(x) : x;
    const yb = (x) => colors ? color_1.colors.reset.yellowBright(x) : x;
    const warnings = [...json.warnings];
    if (json.children) {
        warnings.push(...json.children
            .map((c) => c.warnings)
            .reduce((a, b) => [...a, ...b], []));
    }
    let output = '';
    for (const warning of warnings) {
        if (typeof warning === 'string') {
            if (!ERRONEOUS_WARNINGS_FILTER(warning)) {
                continue;
            }
            output += yb(`Warning: ${warning}\n\n`);
        }
        else {
            if (!ERRONEOUS_WARNINGS_FILTER(warning.message)) {
                continue;
            }
            const file = warning.file || warning.moduleName;
            if (file) {
                output += c(file);
                if (warning.loc) {
                    output += ':' + yb(warning.loc);
                }
                output += ' - ';
            }
            if (!/^warning/i.test(warning.message)) {
                output += y('Warning: ');
            }
            output += `${warning.message}\n\n`;
        }
    }
    if (output) {
        return '\n' + output;
    }
    return '';
}
exports.statsWarningsToString = statsWarningsToString;
function statsErrorsToString(json, statsConfig) {
    const colors = statsConfig.colors;
    const c = (x) => colors ? color_1.colors.reset.cyan(x) : x;
    const yb = (x) => colors ? color_1.colors.reset.yellowBright(x) : x;
    const r = (x) => colors ? color_1.colors.reset.redBright(x) : x;
    const errors = [...json.errors];
    if (json.children) {
        errors.push(...json.children
            .map((c) => c.errors)
            .reduce((a, b) => [...a, ...b], []));
    }
    let output = '';
    for (const error of errors) {
        if (typeof error === 'string') {
            output += r(`Error: ${error}\n\n`);
        }
        else {
            const file = error.file || error.moduleName;
            if (file) {
                output += c(file);
                if (error.loc) {
                    output += ':' + yb(error.loc);
                }
                output += ' - ';
            }
            if (!/^error/i.test(error.message)) {
                output += r('Error: ');
            }
            output += `${error.message}\n\n`;
        }
    }
    if (output) {
        return '\n' + output;
    }
    return '';
}
exports.statsErrorsToString = statsErrorsToString;
function statsHasErrors(json) {
    var _a;
    return json.errors.length || !!((_a = json.children) === null || _a === void 0 ? void 0 : _a.some((c) => c.errors.length));
}
exports.statsHasErrors = statsHasErrors;
function statsHasWarnings(json) {
    var _a;
    return json.warnings.filter(ERRONEOUS_WARNINGS_FILTER).length ||
        !!((_a = json.children) === null || _a === void 0 ? void 0 : _a.some((c) => c.warnings.filter(ERRONEOUS_WARNINGS_FILTER).length));
}
exports.statsHasWarnings = statsHasWarnings;
function createWebpackLoggingCallback(verbose, logger) {
    return (stats, config) => {
        if (verbose) {
            logger.info(stats.toString(config.stats));
        }
        webpackStatsLogger(logger, stats.toJson(config.stats), config);
    };
}
exports.createWebpackLoggingCallback = createWebpackLoggingCallback;
function webpackStatsLogger(logger, json, config, bundleStats) {
    logger.info(statsToString(json, config.stats, bundleStats));
    if (statsHasWarnings(json)) {
        logger.warn(statsWarningsToString(json, config.stats));
    }
    if (statsHasErrors(json)) {
        logger.error(statsErrorsToString(json, config.stats));
    }
}
exports.webpackStatsLogger = webpackStatsLogger;
;
