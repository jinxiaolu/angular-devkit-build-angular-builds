"use strict";
// THIS FILE IS AUTOMATICALLY GENERATED. TO UPDATE THIS FILE YOU NEED TO CHANGE THE
// CORRESPONDING JSON SCHEMA FILE, THEN RUN devkit-admin build (or bazel build ...).
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputHashing = exports.InlineStyleLanguage = exports.I18NTranslation = exports.CrossOrigin = exports.Type = void 0;
/**
 * The type of budget.
 */
var Type;
(function (Type) {
    Type["All"] = "all";
    Type["AllScript"] = "allScript";
    Type["Any"] = "any";
    Type["AnyComponentStyle"] = "anyComponentStyle";
    Type["AnyScript"] = "anyScript";
    Type["Bundle"] = "bundle";
    Type["Initial"] = "initial";
})(Type = exports.Type || (exports.Type = {}));
/**
 * Define the crossorigin attribute setting of elements that provide CORS support.
 */
var CrossOrigin;
(function (CrossOrigin) {
    CrossOrigin["Anonymous"] = "anonymous";
    CrossOrigin["None"] = "none";
    CrossOrigin["UseCredentials"] = "use-credentials";
})(CrossOrigin = exports.CrossOrigin || (exports.CrossOrigin = {}));
/**
 * How to handle duplicate translations for i18n.
 *
 * How to handle missing translations for i18n.
 */
var I18NTranslation;
(function (I18NTranslation) {
    I18NTranslation["Error"] = "error";
    I18NTranslation["Ignore"] = "ignore";
    I18NTranslation["Warning"] = "warning";
})(I18NTranslation = exports.I18NTranslation || (exports.I18NTranslation = {}));
/**
 * The stylesheet language to use for the application's inline component styles.
 */
var InlineStyleLanguage;
(function (InlineStyleLanguage) {
    InlineStyleLanguage["Css"] = "css";
    InlineStyleLanguage["Less"] = "less";
    InlineStyleLanguage["Sass"] = "sass";
    InlineStyleLanguage["Scss"] = "scss";
})(InlineStyleLanguage = exports.InlineStyleLanguage || (exports.InlineStyleLanguage = {}));
/**
 * Define the output filename cache-busting hashing mode.
 */
var OutputHashing;
(function (OutputHashing) {
    OutputHashing["All"] = "all";
    OutputHashing["Bundles"] = "bundles";
    OutputHashing["Media"] = "media";
    OutputHashing["None"] = "none";
})(OutputHashing = exports.OutputHashing || (exports.OutputHashing = {}));
