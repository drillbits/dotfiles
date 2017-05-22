/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';
var vscode_languageserver_1 = require('vscode-languageserver');
var request_light_1 = require('request-light');
var path = require('path');
var fs = require('fs');
var uri_1 = require('./json/utils/uri');
var Strings = require('./json/utils/strings');
var jsonParser_1 = require('./json/jsonParser');
var jsonSchemaService_1 = require('./json/jsonSchemaService');
var configuration_1 = require('./configuration');
var jsonCompletion_1 = require('./json/jsonCompletion');
var yamlParser_1 = require('./yaml/yamlParser');
var TelemetryNotification;
(function (TelemetryNotification) {
    TelemetryNotification.type = { get method() { return 'telemetry'; } };
})(TelemetryNotification || (TelemetryNotification = {}));
var SchemaAssociationNotification;
(function (SchemaAssociationNotification) {
    SchemaAssociationNotification.type = { get method() { return 'json/schemaAssociations'; } };
})(SchemaAssociationNotification || (SchemaAssociationNotification = {}));
var VSCodeContentRequest;
(function (VSCodeContentRequest) {
    VSCodeContentRequest.type = { get method() { return 'vscode/content'; } };
})(VSCodeContentRequest || (VSCodeContentRequest = {}));
// Create a connection for the server. The connection uses
// Node's IPC as a transport
var connection = vscode_languageserver_1.createConnection(new vscode_languageserver_1.IPCMessageReader(process), new vscode_languageserver_1.IPCMessageWriter(process));
// Create a simple text document manager. The text document manager
// supports full document sync only
var documents = new vscode_languageserver_1.TextDocuments();
// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);
// const filesAssociationContribution = new FileAssociationContribution();
// After the server has started the client sends an initilize request. The server receives
// in the passed params the rootPath of the workspace plus the client capabilites.
var workspaceRoot;
connection.onInitialize(function (params) {
    workspaceRoot = uri_1.default.parse(params.rootPath);
    return {
        capabilities: {
            // Tell the client that the server works in FULL text document sync mode
            textDocumentSync: documents.syncKind,
            // Tell the client that the server support code complete
            completionProvider: { resolveProvider: true }
        }
    };
});
var workspaceContext = {
    toResource: function (workspaceRelativePath) {
        if (typeof workspaceRelativePath === 'string' && workspaceRoot) {
            return uri_1.default.file(path.join(workspaceRoot.fsPath, workspaceRelativePath)).toString();
        }
        return workspaceRelativePath;
    }
};
var telemetry = {
    log: function (key, data) {
        connection.sendNotification(TelemetryNotification.type, { key: key, data: data });
    }
};
var request = function (options) {
    if (Strings.startsWith(options.url, 'file://')) {
        var fsPath_1 = uri_1.default.parse(options.url).fsPath;
        return new Promise(function (c, e) {
            fs.readFile(fsPath_1, 'UTF-8', function (err, result) {
                err ? e({ responseText: '', status: 404 }) : c({ responseText: result.toString(), status: 200 });
            });
        });
    }
    else if (Strings.startsWith(options.url, 'vscode://')) {
        return connection.sendRequest(VSCodeContentRequest.type, options.url).then(function (responseText) {
            return {
                responseText: responseText,
                status: 200
            };
        }, function (error) {
            return {
                responseText: error.message,
                status: 404
            };
        });
    }
    return request_light_1.xhr(options);
};
var contributions = [];
var jsonSchemaService = new jsonSchemaService_1.JSONSchemaService(request, workspaceContext, telemetry);
jsonSchemaService.setSchemaContributions(configuration_1.schemaContributions);
var jsonCompletion = new jsonCompletion_1.JSONCompletion(jsonSchemaService, connection.console, contributions);
// let jsonHover = new JSONHover(jsonSchemaService, contributions);
// let jsonDocumentSymbols = new JSONDocumentSymbols();
// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(function (change) {
    validateTextDocument(change.document);
});
// hold the maxNumberOfProblems setting
var maxValidationIssues;
var jsonConfigurationSettings = void 0;
var schemaAssociations = void 0;
// The settings have changed. Is send on server activation as well.
connection.onDidChangeConfiguration(function (change) {
    var settings = change.settings;
    request_light_1.configure(settings.http && settings.http.proxy, settings.http && settings.http.proxyStrictSSL);
    maxValidationIssues = (settings.yaml && settings.yaml.maxValidationIssues) || 100;
    jsonConfigurationSettings = settings.json && settings.json.schemas;
    updateConfiguration();
});
// The jsonValidation extension configuration has changed
connection.onNotification(SchemaAssociationNotification.type, function (associations) {
    schemaAssociations = associations;
    updateConfiguration();
});
function updateConfiguration() {
    jsonSchemaService.clearExternalSchemas();
    if (schemaAssociations) {
        for (var pattern in schemaAssociations) {
            var association = schemaAssociations[pattern];
            if (Array.isArray(association)) {
                association.forEach(function (url) {
                    jsonSchemaService.registerExternalSchema(url, [pattern]);
                });
            }
        }
    }
    if (jsonConfigurationSettings) {
        jsonConfigurationSettings.forEach(function (schema) {
            if (schema.fileMatch) {
                var url = schema.url;
                if (!url && schema.schema) {
                    url = schema.schema.id;
                    if (!url) {
                        url = 'vscode://schemas/custom/' + encodeURIComponent(schema.fileMatch.join('&'));
                    }
                }
                if (!Strings.startsWith(url, 'http://') && !Strings.startsWith(url, 'https://') && !Strings.startsWith(url, 'file://')) {
                    var resourceURL = workspaceContext.toResource(url);
                    if (resourceURL) {
                        url = resourceURL.toString();
                    }
                }
                if (url) {
                    jsonSchemaService.registerExternalSchema(url, schema.fileMatch, schema.schema);
                }
            }
        });
    }
    // Revalidate any open text documents
    documents.all().forEach(validateTextDocument);
}
// This is where the magic begins
function validateTextDocument(textDocument) {
    // Gets a parsed document (AST)
    var yamlDocument = yamlParser_1.parse(textDocument.getText(), null);
    jsonSchemaService.getSchemaForResource(textDocument.uri, yamlDocument).then(function (schema) {
        if (schema) {
            if (schema.errors.length && yamlDocument.root) {
                var astRoot = yamlDocument.root;
                var property = astRoot.type === 'object' ? astRoot.getFirstProperty('$schema') : null;
                if (property) {
                    var node = property.value || property;
                    yamlDocument.warnings.push({ location: { start: node.start, end: node.end }, message: schema.errors[0] });
                }
                else {
                    yamlDocument.warnings.push({ location: { start: astRoot.start, end: astRoot.start + 1 }, message: schema.errors[0] });
                }
            }
            else {
                yamlDocument.validate(schema.schema);
            }
        }
        var diagnostics = [];
        var added = {};
        yamlDocument.errors.concat(yamlDocument.warnings).forEach(function (error, idx) {
            // remove duplicated messages
            var signature = error.location.start + ' ' + error.location.end + ' ' + error.message;
            if (!added[signature]) {
                added[signature] = true;
                var range = {
                    start: textDocument.positionAt(error.location.start),
                    end: textDocument.positionAt(error.location.end)
                };
                diagnostics.push({
                    severity: idx >= yamlDocument.errors.length ? vscode_languageserver_1.DiagnosticSeverity.Warning : vscode_languageserver_1.DiagnosticSeverity.Error,
                    range: range,
                    message: error.message
                });
            }
        });
        // Send the computed diagnostics to VSCode.
        connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: diagnostics });
    });
}
connection.onDidChangeWatchedFiles(function (change) {
    // Monitored files have change in VSCode
    connection.console.log('We recevied an file change event');
    // Monitored files have change in VSCode
    var hasChanges = false;
    change.changes.forEach(function (c) {
        if (jsonSchemaService.onResourceChange(c.uri)) {
            hasChanges = true;
        }
    });
    if (hasChanges) {
        documents.all().forEach(validateTextDocument);
    }
});
function getJSONDocument(document) {
    return jsonParser_1.parse(document.getText());
}
// This handler provides the initial list of the completion items.
connection.onCompletion(function (textDocumentPosition) {
    var document = documents.get(textDocumentPosition.uri);
    var jsonDocument = getJSONDocument(document);
    return jsonCompletion.doSuggest(document, textDocumentPosition, jsonDocument);
});
connection.onCompletionResolve(function (item) {
    return jsonCompletion.doResolve(item);
});
// connection.onHover((textDocumentPosition: TextDocumentPosition): Thenable<Hover> => {
// 	let document = documents.get(textDocumentPosition.uri);
// 	let jsonDocument = getJSONDocument(document);
// 	return jsonHover.doHover(document, textDocumentPosition, jsonDocument);
// });
// connection.onDocumentSymbol((textDocumentIdentifier: TextDocumentIdentifier): Thenable<SymbolInformation[]> => {
// 	let document = documents.get(textDocumentIdentifier.uri);
// 	let jsonDocument = getJSONDocument(document);
// 	return jsonDocumentSymbols.compute(document, jsonDocument);
// });
// connection.onDocumentFormatting((formatParams: DocumentFormattingParams) => {
// 	let document = documents.get(formatParams.textDocument.uri);
// 	return formatJSON(document, null, formatParams.options);
// });
// connection.onDocumentRangeFormatting((formatParams: DocumentRangeFormattingParams) => {
// 	let document = documents.get(formatParams.textDocument.uri);
// 	return formatJSON(document, formatParams.range, formatParams.options);
// });
// This handler resolve additional information for the item selected in
// the completion list.
// connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
// 	if (item.data === 1) {
// 		item.detail = 'TypeScript details',
// 		item.documentation = 'TypeScript documentation'
// 	} else if (item.data === 2) {
// 		item.detail = 'JavaScript details',
// 		item.documentation = 'JavaScript documentation'
// 	}
// 	return item;
// });
/*
connection.onDidOpenTextDocument((params) => {
    // A text document got opened in VSCode.
    // params.uri uniquely identifies the document. For documents store on disk this is a file URI.
    // params.text the initial full content of the document.
    connection.console.log(`${params.uri} opened.`);
});

connection.onDidChangeTextDocument((params) => {
    // The content of a text document did change in VSCode.
    // params.uri uniquely identifies the document.
    // params.contentChanges describe the content changes to the document.
    connection.console.log(`${params.uri} changed: ${JSON.stringify(params.contentChanges)}`);
});

connection.onDidCloseTextDocument((params) => {
    // A text document got closed in VSCode.
    // params.uri uniquely identifies the document.
    connection.console.log(`${params.uri} closed.`);
});
*/
// Listen on the connection
connection.listen();
//# sourceMappingURL=server.js.map