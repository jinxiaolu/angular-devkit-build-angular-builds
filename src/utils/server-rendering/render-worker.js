"use strict";
/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
Object.defineProperty(exports, "__esModule", { value: true });
const node_worker_threads_1 = require("node:worker_threads");
const render_page_1 = require("./render-page");
/**
 * This is passed as workerData when setting up the worker via the `piscina` package.
 */
const { outputFiles, document, inlineCriticalCss } = node_worker_threads_1.workerData;
function default_1(options) {
    return (0, render_page_1.renderPage)({ ...options, outputFiles, document, inlineCriticalCss });
}
exports.default = default_1;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVuZGVyLXdvcmtlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2FuZ3VsYXJfZGV2a2l0L2J1aWxkX2FuZ3VsYXIvc3JjL3V0aWxzL3NlcnZlci1yZW5kZXJpbmcvcmVuZGVyLXdvcmtlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7OztHQU1HOztBQUVILDZEQUFpRDtBQUVqRCwrQ0FBd0U7QUFZeEU7O0dBRUc7QUFDSCxNQUFNLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxpQkFBaUIsRUFBRSxHQUFHLGdDQUE4QixDQUFDO0FBRXBGLG1CQUF5QixPQUFzQjtJQUM3QyxPQUFPLElBQUEsd0JBQVUsRUFBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDO0FBQzlFLENBQUM7QUFGRCw0QkFFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyB3b3JrZXJEYXRhIH0gZnJvbSAnbm9kZTp3b3JrZXJfdGhyZWFkcyc7XG5pbXBvcnQgdHlwZSB7IEVTTUluTWVtb3J5RmlsZUxvYWRlcldvcmtlckRhdGEgfSBmcm9tICcuL2VzbS1pbi1tZW1vcnktbG9hZGVyL2xvYWRlci1ob29rcyc7XG5pbXBvcnQgeyBSZW5kZXJSZXN1bHQsIFNlcnZlckNvbnRleHQsIHJlbmRlclBhZ2UgfSBmcm9tICcuL3JlbmRlci1wYWdlJztcblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJXb3JrZXJEYXRhIGV4dGVuZHMgRVNNSW5NZW1vcnlGaWxlTG9hZGVyV29ya2VyRGF0YSB7XG4gIGRvY3VtZW50OiBzdHJpbmc7XG4gIGlubGluZUNyaXRpY2FsQ3NzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZW5kZXJPcHRpb25zIHtcbiAgcm91dGU6IHN0cmluZztcbiAgc2VydmVyQ29udGV4dDogU2VydmVyQ29udGV4dDtcbn1cblxuLyoqXG4gKiBUaGlzIGlzIHBhc3NlZCBhcyB3b3JrZXJEYXRhIHdoZW4gc2V0dGluZyB1cCB0aGUgd29ya2VyIHZpYSB0aGUgYHBpc2NpbmFgIHBhY2thZ2UuXG4gKi9cbmNvbnN0IHsgb3V0cHV0RmlsZXMsIGRvY3VtZW50LCBpbmxpbmVDcml0aWNhbENzcyB9ID0gd29ya2VyRGF0YSBhcyBSZW5kZXJXb3JrZXJEYXRhO1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiAob3B0aW9uczogUmVuZGVyT3B0aW9ucyk6IFByb21pc2U8UmVuZGVyUmVzdWx0PiB7XG4gIHJldHVybiByZW5kZXJQYWdlKHsgLi4ub3B0aW9ucywgb3V0cHV0RmlsZXMsIGRvY3VtZW50LCBpbmxpbmVDcml0aWNhbENzcyB9KTtcbn1cbiJdfQ==