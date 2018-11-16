"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
const loader_utils_1 = require("loader-utils");
const path = require("path");
const postcss = require("postcss");
const url = require("url");
function wrapUrl(url) {
    let wrappedUrl;
    const hasSingleQuotes = url.indexOf('\'') >= 0;
    if (hasSingleQuotes) {
        wrappedUrl = `"${url}"`;
    }
    else {
        wrappedUrl = `'${url}'`;
    }
    return `url(${wrappedUrl})`;
}
async function resolve(file, base, resolver) {
    try {
        return await resolver('./' + file, base);
    }
    catch (_a) {
        return resolver(file, base);
    }
}
exports.default = postcss.plugin('postcss-cli-resources', (options) => {
    const { deployUrl = '', baseHref = '', resourcesOutputPath = '', filename, loader, } = options;
    const dedupeSlashes = (url) => url.replace(/\/\/+/g, '/');
    const process = async (inputUrl, context, resourceCache) => {
        // If root-relative, absolute or protocol relative url, leave as is
        if (/^((?:\w+:)?\/\/|data:|chrome:|#)/.test(inputUrl)) {
            return inputUrl;
        }
        // If starts with a caret, remove and return remainder
        // this supports bypassing asset processing
        if (inputUrl.startsWith('^')) {
            return inputUrl.substr(1);
        }
        const cacheKey = path.resolve(context, inputUrl);
        const cachedUrl = resourceCache.get(cacheKey);
        if (cachedUrl) {
            return cachedUrl;
        }
        if (inputUrl.startsWith('~')) {
            inputUrl = inputUrl.substr(1);
        }
        if (inputUrl.startsWith('/')) {
            let outputUrl = '';
            if (deployUrl.match(/:\/\//) || deployUrl.startsWith('/')) {
                // If deployUrl is absolute or root relative, ignore baseHref & use deployUrl as is.
                outputUrl = `${deployUrl.replace(/\/$/, '')}${inputUrl}`;
            }
            else if (baseHref.match(/:\/\//)) {
                // If baseHref contains a scheme, include it as is.
                outputUrl = baseHref.replace(/\/$/, '') + dedupeSlashes(`/${deployUrl}/${inputUrl}`);
            }
            else {
                // Join together base-href, deploy-url and the original URL.
                outputUrl = dedupeSlashes(`/${baseHref}/${deployUrl}/${inputUrl}`);
            }
            resourceCache.set(cacheKey, outputUrl);
            return outputUrl;
        }
        const { pathname, hash, search } = url.parse(inputUrl.replace(/\\/g, '/'));
        const resolver = (file, base) => new Promise((resolve, reject) => {
            loader.resolve(base, file, (err, result) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(result);
            });
        });
        const result = await resolve(pathname, context, resolver);
        return new Promise((resolve, reject) => {
            loader.fs.readFile(result, (err, content) => {
                if (err) {
                    reject(err);
                    return;
                }
                let outputPath = loader_utils_1.interpolateName({ resourcePath: result }, filename, { content });
                if (resourcesOutputPath) {
                    outputPath = path.posix.join(resourcesOutputPath, outputPath);
                }
                loader.addDependency(result);
                loader.emitFile(outputPath, content, undefined);
                let outputUrl = outputPath.replace(/\\/g, '/');
                if (hash || search) {
                    outputUrl = url.format({ pathname: outputUrl, hash, search });
                }
                if (deployUrl && loader.loaders[loader.loaderIndex].options.ident !== 'extracted') {
                    outputUrl = url.resolve(deployUrl, outputUrl);
                }
                resourceCache.set(cacheKey, outputUrl);
                resolve(outputUrl);
            });
        });
    };
    return (root) => {
        const urlDeclarations = [];
        root.walkDecls(decl => {
            if (decl.value && decl.value.includes('url')) {
                urlDeclarations.push(decl);
            }
        });
        if (urlDeclarations.length === 0) {
            return;
        }
        const resourceCache = new Map();
        return Promise.all(urlDeclarations.map(async (decl) => {
            const value = decl.value;
            const urlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|(.+?))\s*\)/g;
            const segments = [];
            let match;
            let lastIndex = 0;
            let modified = false;
            // We want to load it relative to the file that imports
            const context = path.dirname(decl.source.input.file);
            // tslint:disable-next-line:no-conditional-assignment
            while (match = urlRegex.exec(value)) {
                const originalUrl = match[1] || match[2] || match[3];
                let processedUrl;
                try {
                    processedUrl = await process(originalUrl, context, resourceCache);
                }
                catch (err) {
                    loader.emitError(decl.error(err.message, { word: originalUrl }).toString());
                    continue;
                }
                if (lastIndex < match.index) {
                    segments.push(value.slice(lastIndex, match.index));
                }
                if (!processedUrl || originalUrl === processedUrl) {
                    segments.push(match[0]);
                }
                else {
                    segments.push(wrapUrl(processedUrl));
                    modified = true;
                }
                lastIndex = match.index + match[0].length;
            }
            if (lastIndex < value.length) {
                segments.push(value.slice(lastIndex));
            }
            if (modified) {
                decl.value = segments.join('');
            }
        }));
    };
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicG9zdGNzcy1jbGktcmVzb3VyY2VzLmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9idWlsZF9hbmd1bGFyL3NyYy9hbmd1bGFyLWNsaS1maWxlcy9wbHVnaW5zL3Bvc3Rjc3MtY2xpLXJlc291cmNlcy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7Ozs7R0FNRztBQUNILCtDQUErQztBQUMvQyw2QkFBNkI7QUFDN0IsbUNBQW1DO0FBQ25DLDJCQUEyQjtBQUczQixTQUFTLE9BQU8sQ0FBQyxHQUFXO0lBQzFCLElBQUksVUFBVSxDQUFDO0lBQ2YsTUFBTSxlQUFlLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7SUFFL0MsSUFBSSxlQUFlLEVBQUU7UUFDbkIsVUFBVSxHQUFHLElBQUksR0FBRyxHQUFHLENBQUM7S0FDekI7U0FBTTtRQUNMLFVBQVUsR0FBRyxJQUFJLEdBQUcsR0FBRyxDQUFDO0tBQ3pCO0lBRUQsT0FBTyxPQUFPLFVBQVUsR0FBRyxDQUFDO0FBQzlCLENBQUM7QUFVRCxLQUFLLFVBQVUsT0FBTyxDQUNwQixJQUFZLEVBQ1osSUFBWSxFQUNaLFFBQXlEO0lBRXpELElBQUk7UUFDRixPQUFPLE1BQU0sUUFBUSxDQUFDLElBQUksR0FBRyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7S0FDMUM7SUFBQyxXQUFNO1FBQ04sT0FBTyxRQUFRLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0tBQzdCO0FBQ0gsQ0FBQztBQUVELGtCQUFlLE9BQU8sQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyxPQUFtQyxFQUFFLEVBQUU7SUFDN0YsTUFBTSxFQUNKLFNBQVMsR0FBRyxFQUFFLEVBQ2QsUUFBUSxHQUFHLEVBQUUsRUFDYixtQkFBbUIsR0FBRyxFQUFFLEVBQ3hCLFFBQVEsRUFDUixNQUFNLEdBQ1AsR0FBRyxPQUFPLENB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QUFDLEVBQUUsQ0FBQyxDQUFDO2FBQ2hDO1FBQ0gsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNOLENBQUMsQ0FBQztBQUNKLENBQUMsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuaW1wb3J0IHsgaW50ZXJwb2xhdGVOYW1lIH0gZnJvbSAnbG9hZGVyLXV0aWxzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgKiBhcyBwb3N0Y3NzIGZyb20gJ3Bvc3Rjc3MnO1xuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XG5pbXBvcnQgKiBhcyB3ZWJwYWNrIGZyb20gJ3dlYnBhY2snO1xuXG5mdW5jdGlvbiB3cmFwVXJsKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgbGV0IHdyYXBwZWRVcmw7XG4gIGNvbnN0IGhhc1NpbmdsZVF1b3RlcyA9IHVybC5pbmRleE9mKCdcXCcnKSA+PSAwO1xuXG4gIGlmIChoYXNTaW5nbGVRdW90ZXMpIHtcbiAgICB3cmFwcGVkVXJsID0gYFwiJHt1cmx9XCJgO1xuICB9IGVsc2Uge1xuICAgIHdyYXBwZWRVcmwgPSBgJyR7dXJsfSdgO1xuICB9XG5cbiAgcmV0dXJuIGB1cmwoJHt3cmFwcGVkVXJsfSlgO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFBvc3Rjc3NDbGlSZXNvdXJjZXNPcHRpb25zIHtcbiAgYmFzZUhyZWY/OiBzdHJpbmc7XG4gIGRlcGxveVVybD86IHN0cmluZztcbiAgcmVzb3VyY2VzT3V0cHV0UGF0aD86IHN0cmluZztcbiAgZmlsZW5hbWU6IHN0cmluZztcbiAgbG9hZGVyOiB3ZWJwYWNrLmxvYWRlci5Mb2FkZXJDb250ZXh0O1xufVxuXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlKFxuICBmaWxlOiBzdHJpbmcsXG4gIGJhc2U6IHN0cmluZyxcbiAgcmVzb2x2ZXI6IChmaWxlOiBzdHJpbmcsIGJhc2U6IHN0cmluZykgPT4gUHJvbWlzZTxzdHJpbmc+LFxuKTogUHJvbWlzZTxzdHJpbmc+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgcmVzb2x2ZXIoJy4vJyArIGZpbGUsIGJhc2UpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gcmVzb2x2ZXIoZmlsZSwgYmFzZSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9zdGNzcy5wbHVnaW4oJ3Bvc3Rjc3MtY2xpLXJlc291cmNlcycsIChvcHRpb25zOiBQb3N0Y3NzQ2xpUmVzb3VyY2VzT3B0aW9ucykgPT4ge1xuICBjb25zdCB7XG4gICAgZGVwbG95VXJsID0gJycsXG4gICAgYmFzZUhyZWYgPSAnJyxcbiAgICByZXNvdXJjZXNPdXRwdXRQYXRoID0gJycsXG4gICAgZmlsZW5hbWUsXG4gICAgbG9hZGVyLFxuICB9ID0gb3B0aW9ucztcblxuICBjb25zdCBkZWR1cGVTbGFzaGVzID0gKHVybDogc3RyaW5nKSA9PiB1cmwucmVwbGFjZSgvXFwvXFwvKy9nLCAnLycpO1xuXG4gIGNvbnN0IHByb2Nlc3MgPSBhc3luYyAoaW5wdXRVcmw6IHN0cmluZywgY29udGV4dDogc3RyaW5nLCByZXNvdXJjZUNhY2hlOiBNYXA8c3RyaW5nLCBzdHJpbmc+KSA9PiB7XG4gICAgLy8gSWYgcm9vdC1yZWxhdGl2ZSwgYWJzb2x1dGUgb3IgcHJvdG9jb2wgcmVsYXRpdmUgdXJsLCBsZWF2ZSBhcyBpc1xuICAgIGlmICgvXigoPzpcXHcrOik/XFwvXFwvfGRhdGE6fGNocm9tZTp8IykvLnRlc3QoaW5wdXRVcmwpKSB7XG4gICAgICByZXR1cm4gaW5wdXRVcmw7XG4gICAgfVxuXG4gICAgLy8gSWYgc3RhcnRzIHdpdGggYSBjYXJldCwgcmVtb3ZlIGFuZCByZXR1cm4gcmVtYWluZGVyXG4gICAgLy8gdGhpcyBzdXBwb3J0cyBieXBhc3NpbmcgYXNzZXQgcHJvY2Vzc2luZ1xuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCdeJykpIHtcbiAgICAgIHJldHVybiBpbnB1dFVybC5zdWJzdHIoMSk7XG4gICAgfVxuXG4gICAgY29uc3QgY2FjaGVLZXkgPSBwYXRoLnJlc29sdmUoY29udGV4dCwgaW5wdXRVcmwpO1xuICAgIGNvbnN0IGNhY2hlZFVybCA9IHJlc291cmNlQ2FjaGUuZ2V0KGNhY2hlS2V5KTtcbiAgICBpZiAoY2FjaGVkVXJsKSB7XG4gICAgICByZXR1cm4gY2FjaGVkVXJsO1xuICAgIH1cblxuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCd+JykpIHtcbiAgICAgIGlucHV0VXJsID0gaW5wdXRVcmwuc3Vic3RyKDEpO1xuICAgIH1cblxuICAgIGlmIChpbnB1dFVybC5zdGFydHNXaXRoKCcvJykpIHtcbiAgICAgIGxldCBvdXRwdXRVcmwgPSAnJztcbiAgICAgIGlmIChkZXBsb3lVcmwubWF0Y2goLzpcXC9cXC8vKSB8fCBkZXBsb3lVcmwuc3RhcnRzV2l0aCgnLycpKSB7XG4gICAgICAgIC8vIElmIGRlcGxveVVybCBpcyBhYnNvbHV0ZSBvciByb290IHJlbGF0aXZlLCBpZ25vcmUgYmFzZUhyZWYgJiB1c2UgZGVwbG95VXJsIGFzIGlzLlxuICAgICAgICBvdXRwdXRVcmwgPSBgJHtkZXBsb3lVcmwucmVwbGFjZSgvXFwvJC8sICcnKX0ke2lucHV0VXJsfWA7XG4gICAgICB9IGVsc2UgaWYgKGJhc2VIcmVmLm1hdGNoKC86XFwvXFwvLykpIHtcbiAgICAgICAgLy8gSWYgYmFzZUhyZWYgY29udGFpbnMgYSBzY2hlbWUsIGluY2x1ZGUgaXQgYXMgaXMuXG4gICAgICAgIG91dHB1dFVybCA9IGJhc2VIcmVmLnJlcGxhY2UoL1xcLyQvLCAnJykgKyBkZWR1cGVTbGFzaGVzKGAvJHtkZXBsb3lVcmx9LyR7aW5wdXRVcmx9YCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBKb2luIHRvZ2V0aGVyIGJhc2UtaHJlZiwgZGVwbG95LXVybCBhbmQgdGhlIG9yaWdpbmFsIFVSTC5cbiAgICAgICAgb3V0cHV0VXJsID0gZGVkdXBlU2xhc2hlcyhgLyR7YmFzZUhyZWZ9LyR7ZGVwbG95VXJsfS8ke2lucHV0VXJsfWApO1xuICAgICAgfVxuXG4gICAgICByZXNvdXJjZUNhY2hlLnNldChjYWNoZUtleSwgb3V0cHV0VXJsKTtcblxuICAgICAgcmV0dXJuIG91dHB1dFVybDtcbiAgICB9XG5cbiAgICBjb25zdCB7IHBhdGhuYW1lLCBoYXNoLCBzZWFyY2ggfSA9IHVybC5wYXJzZShpbnB1dFVybC5yZXBsYWNlKC9cXFxcL2csICcvJykpO1xuICAgIGNvbnN0IHJlc29sdmVyID0gKGZpbGU6IHN0cmluZywgYmFzZTogc3RyaW5nKSA9PiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIGxvYWRlci5yZXNvbHZlKGJhc2UsIGZpbGUsIChlcnIsIHJlc3VsdCkgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCByZXN1bHQgPSBhd2FpdCByZXNvbHZlKHBhdGhuYW1lIGFzIHN0cmluZywgY29udGV4dCwgcmVzb2x2ZXIpO1xuXG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgbG9hZGVyLmZzLnJlYWRGaWxlKHJlc3VsdCwgKGVycjogRXJyb3IsIGNvbnRlbnQ6IEJ1ZmZlcikgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG5cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgb3V0cHV0UGF0aCA9IGludGVycG9sYXRlTmFtZShcbiAgICAgICAgICB7IHJlc291cmNlUGF0aDogcmVzdWx0IH0gYXMgd2VicGFjay5sb2FkZXIuTG9hZGVyQ29udGV4dCxcbiAgICAgICAgICBmaWxlbmFtZSxcbiAgICAgICAgICB7IGNvbnRlbnQgfSxcbiAgICAgICAgKTtcblxuICAgICAgICBpZiAocmVzb3VyY2VzT3V0cHV0UGF0aCkge1xuICAgICAgICAgIG91dHB1dFBhdGggPSBwYXRoLnBvc2l4LmpvaW4ocmVzb3VyY2VzT3V0cHV0UGF0aCwgb3V0cHV0UGF0aCk7XG4gICAgICAgIH1cblxuICAgICAgICBsb2FkZXIuYWRkRGVwZW5kZW5jeShyZXN1bHQpO1xuICAgICAgICBsb2FkZXIuZW1pdEZpbGUob3V0cHV0UGF0aCwgY29udGVudCwgdW5kZWZpbmVkKTtcblxuICAgICAgICBsZXQgb3V0cHV0VXJsID0gb3V0cHV0UGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICAgIGlmIChoYXNoIHx8IHNlYXJjaCkge1xuICAgICAgICAgIG91dHB1dFVybCA9IHVybC5mb3JtYXQoeyBwYXRobmFtZTogb3V0cHV0VXJsLCBoYXNoLCBzZWFyY2ggfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZGVwbG95VXJsICYmIGxvYWRlci5sb2FkZXJzW2xvYWRlci5sb2FkZXJJbmRleF0ub3B0aW9ucy5pZGVudCAhPT0gJ2V4dHJhY3RlZCcpIHtcbiAgICAgICAgICBvdXRwdXRVcmwgPSB1cmwucmVzb2x2ZShkZXBsb3lVcmwsIG91dHB1dFVybCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXNvdXJjZUNhY2hlLnNldChjYWNoZUtleSwgb3V0cHV0VXJsKTtcbiAgICAgICAgcmVzb2x2ZShvdXRwdXRVcmwpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG5cbiAgcmV0dXJuIChyb290KSA9PiB7XG4gICAgY29uc3QgdXJsRGVjbGFyYXRpb25zOiBBcnJheTxwb3N0Y3NzLkRlY2xhcmF0aW9uPiA9IFtdO1xuICAgIHJvb3Qud2Fsa0RlY2xzKGRlY2wgPT4ge1xuICAgICAgaWYgKGRlY2wudmFsdWUgJiYgZGVjbC52YWx1ZS5pbmNsdWRlcygndXJsJykpIHtcbiAgICAgICAgdXJsRGVjbGFyYXRpb25zLnB1c2goZGVjbCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBpZiAodXJsRGVjbGFyYXRpb25zLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHJlc291cmNlQ2FjaGUgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHVybERlY2xhcmF0aW9ucy5tYXAoYXN5bmMgZGVjbCA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IGRlY2wudmFsdWU7XG4gICAgICBjb25zdCB1cmxSZWdleCA9IC91cmxcXChcXHMqKD86XCIoW15cIl0rKVwifCcoW14nXSspJ3woLis/KSlcXHMqXFwpL2c7XG4gICAgICBjb25zdCBzZWdtZW50czogc3RyaW5nW10gPSBbXTtcblxuICAgICAgbGV0IG1hdGNoO1xuICAgICAgbGV0IGxhc3RJbmRleCA9IDA7XG4gICAgICBsZXQgbW9kaWZpZWQgPSBmYWxzZTtcblxuICAgICAgLy8gV2Ugd2FudCB0byBsb2FkIGl0IHJlbGF0aXZlIHRvIHRoZSBmaWxlIHRoYXQgaW1wb3J0c1xuICAgICAgY29uc3QgY29udGV4dCA9IHBhdGguZGlybmFtZShkZWNsLnNvdXJjZS5pbnB1dC5maWxlKTtcblxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOm5vLWNvbmRpdGlvbmFsLWFzc2lnbm1lbnRcbiAgICAgIHdoaWxlIChtYXRjaCA9IHVybFJlZ2V4LmV4ZWModmFsdWUpKSB7XG4gICAgICAgIGNvbnN0IG9yaWdpbmFsVXJsID0gbWF0Y2hbMV0gfHwgbWF0Y2hbMl0gfHwgbWF0Y2hbM107XG4gICAgICAgIGxldCBwcm9jZXNzZWRVcmw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgcHJvY2Vzc2VkVXJsID0gYXdhaXQgcHJvY2VzcyhvcmlnaW5hbFVybCwgY29udGV4dCwgcmVzb3VyY2VDYWNoZSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAgIGxvYWRlci5lbWl0RXJyb3IoZGVjbC5lcnJvcihlcnIubWVzc2FnZSwgeyB3b3JkOiBvcmlnaW5hbFVybCB9KS50b1N0cmluZygpKTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChsYXN0SW5kZXggPCBtYXRjaC5pbmRleCkge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2godmFsdWUuc2xpY2UobGFzdEluZGV4LCBtYXRjaC5pbmRleCkpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFwcm9jZXNzZWRVcmwgfHwgb3JpZ2luYWxVcmwgPT09IHByb2Nlc3NlZFVybCkge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2gobWF0Y2hbMF0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlZ21lbnRzLnB1c2god3JhcFVybChwcm9jZXNzZWRVcmwpKTtcbiAgICAgICAgICBtb2RpZmllZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBsYXN0SW5kZXggPSBtYXRjaC5pbmRleCArIG1hdGNoWzBdLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgaWYgKGxhc3RJbmRleCA8IHZhbHVlLmxlbmd0aCkge1xuICAgICAgICBzZWdtZW50cy5wdXNoKHZhbHVlLnNsaWNlKGxhc3RJbmRleCkpO1xuICAgICAgfVxuXG4gICAgICBpZiAobW9kaWZpZWQpIHtcbiAgICAgICAgZGVjbC52YWx1ZSA9IHNlZ21lbnRzLmpvaW4oJycpO1xuICAgICAgfVxuICAgIH0pKTtcbiAgfTtcbn0pO1xuIl19