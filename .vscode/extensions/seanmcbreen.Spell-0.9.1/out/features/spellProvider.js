'use strict';
var vscode = require('vscode');
var fs = require('fs');
var delayer_1 = require('./delayer');
var callATD = require('./callATD');
var DEBUG = false;
var problems = [];
var settings;
var diagnosticMap = {};
var spellDiagnostics;
var CONFIGFOLDER = "/.vscode";
var CONFIGFILE = "/spell.json";
var statusBarItem;
var IsDisabled = false;
var SpellProvider = (function () {
    function SpellProvider() {
        this.validationDelayer = Object.create(null); // key is the URI of the document
    }
    SpellProvider.prototype.activate = function (context) {
        if (DEBUG)
            console.log("Spell and Grammar checker active...");
        var subscriptions = context.subscriptions;
        var toggleCmd;
        vscode.commands.registerCommand("toggleSpell", this.toggleSpell.bind(this));
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusBarItem.command = "toggleSpell";
        statusBarItem.tooltip = "Toggle Spell Checker On/Off for supported files";
        statusBarItem.show();
        settings = this.readSettings();
        this.addToDictionaryCmd = vscode.commands.registerCommand(SpellProvider.addToDictionaryCmdId, this.addToDictionary.bind(this));
        this.fixOnSuggestionCmd = vscode.commands.registerCommand(SpellProvider.fixOnSuggestionCmdId, this.fixOnSuggestion.bind(this));
        this.changeLanguageCmd = vscode.commands.registerCommand(SpellProvider.changeLanguageCmdId, this.changeLanguage.bind(this));
        subscriptions.push(this);
        spellDiagnostics = vscode.languages.createDiagnosticCollection('Spell');
        vscode.workspace.onDidOpenTextDocument(this.TriggerDiagnostics, this, subscriptions);
        vscode.workspace.onDidChangeTextDocument(this.TriggerDiffDiagnostics, this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this.TriggerDiagnostics, this, subscriptions);
        vscode.workspace.onDidCloseTextDocument(function (textDocument) {
            spellDiagnostics.delete(textDocument.uri);
        }, null, subscriptions);
        if (vscode.window.activeTextEditor) {
            this.TriggerDiagnostics(vscode.window.activeTextEditor.document);
        }
        for (var i = 0; i < settings.languageIDs.length; i++) {
            if (DEBUG)
                console.log("Code Actons Registering for: " + settings.languageIDs[i]);
            vscode.languages.registerCodeActionsProvider(settings.languageIDs[i], this);
        }
    };
    SpellProvider.prototype.toggleSpell = function () {
        if (IsDisabled) {
            IsDisabled = false;
            if (vscode.window.activeTextEditor) {
                this.TriggerDiagnostics(vscode.window.activeTextEditor.document);
            }
        }
        else {
            IsDisabled = true;
            if (DEBUG)
                console.log("Clearing diagnostics as Spell was disabled.");
            spellDiagnostics.clear();
        }
        this.updateStatus();
    };
    SpellProvider.prototype.updateStatus = function () {
        if (IsDisabled) {
            statusBarItem.text = "$(book) Spell Disabled [" + settings.language + "]";
            statusBarItem.color = "orange";
        }
        else {
            statusBarItem.text = "$(book) Spell Enabled [" + settings.language + "]";
            statusBarItem.color = "white";
        }
    };
    SpellProvider.prototype.dispose = function () {
        spellDiagnostics.clear();
        spellDiagnostics.dispose();
        statusBarItem.dispose();
        this.addToDictionaryCmd.dispose();
        this.fixOnSuggestionCmd.dispose();
        this.changeLanguageCmd.dispose();
    };
    SpellProvider.prototype.provideCodeActions = function (document, range, context, token) {
        var diagnostic = context.diagnostics[0];
        var match = diagnostic.message.match(/\[([a-zA-Z0-9\ ]+)\]\ \-/);
        var error = '';
        // should always be true
        if (match.length >= 2)
            error = match[1];
        if (error.length == 0)
            return undefined;
        // Get suggestions from suggestion string
        match = diagnostic.message.match(/\[([a-zA-Z0-9,\ ]+)\]$/);
        var suggestionstring = '';
        var commands = [];
        // Add each suggestion
        if (match && match.length >= 2) {
            suggestionstring = match[1];
            var suggestions = suggestionstring.split(/\,\ /g);
            // Add suggestions to command list
            suggestions.forEach(function (suggestion) {
                commands.push({
                    title: 'Replace with \'' + suggestion + '\'',
                    command: SpellProvider.fixOnSuggestionCmdId,
                    arguments: [document, diagnostic, error, suggestion]
                });
            });
        }
        // Add ignore command
        commands.push({
            title: 'Add \'' + error + '\' to ignore list',
            command: SpellProvider.addToDictionaryCmdId,
            arguments: [document, error]
        });
        return commands;
    };
    // Itterate through the errors and populate the diagnostics - this has a delayer to lower the traffic
    SpellProvider.prototype.TriggerDiagnostics = function (document) {
        var _this = this;
        // Do nothing if the doc type is not one we should test
        if (settings.languageIDs.indexOf(document.languageId) === -1) {
            // if(DEBUG) console.log("Hiding status due to language ID [" + document.languageId + "]");
            // //statusBarItem.hide();
            return;
        }
        else {
            this.updateStatus();
        }
        if (IsDisabled)
            return;
        var d = this.validationDelayer[document.uri.toString()];
        if (!d) {
            d = new delayer_1.Delayer(150);
            this.validationDelayer[document.uri.toString()] = d;
        }
        d.trigger(function () {
            _this.CreateDiagnostics(document);
            delete _this.validationDelayer[document.uri.toString()];
        });
    };
    // NOT GOOD :(
    SpellProvider.prototype.TriggerDiffDiagnostics = function (event) {
        this.TriggerDiagnostics(event.document);
    };
    // Itterate through the errors and populate the diagnostics
    SpellProvider.prototype.CreateDiagnostics = function (document) {
        var _this = this;
        var diagnostics = [];
        var docToCheck = document.getText();
        if (DEBUG)
            console.log("Starting new check on: " + document.fileName + " [" + document.languageId + "]");
        problems = [];
        // removeUnwantedText before processing the spell checker ignores a lot of chars so removing them aids in problem matching
        docToCheck = this.removeUnwantedText(docToCheck);
        docToCheck = docToCheck.replace(/[\"!#$%&()*+,.\/:;<=>?@\[\]\\^_{|}]/g, " ");
        this.spellcheckDocument(docToCheck, function (problems) {
            for (var x = 0; x < problems.length; x++) {
                var problem = problems[x];
                if (settings.ignoreWordsList.indexOf(problem.error) === -1) {
                    if (_this.convertSeverity(problem.type) !== -1) {
                        var lineRange = new vscode.Range(problem.startLine, problem.startChar, problem.endLine, problem.endChar);
                        var loc = new vscode.Location(document.uri, lineRange);
                        var diag = new vscode.Diagnostic(lineRange, problem.message, _this.convertSeverity(problem.type));
                        diagnostics.push(diag);
                    }
                }
            }
            spellDiagnostics.set(document.uri, diagnostics);
            diagnosticMap[document.uri.toString()] = diagnostics;
        });
    };
    SpellProvider.prototype.addToDictionary = function (document, word) {
        if (DEBUG)
            console.log("Attempting to add to dictionary: " + word);
        // only add if it's not already there
        if (settings.ignoreWordsList.indexOf(word) === -1) {
            if (DEBUG)
                console.log("Word is not found in current dictionary -> adding");
            settings.ignoreWordsList.push(word);
            this.writeSettings();
        }
        this.TriggerDiagnostics(document);
    };
    SpellProvider.prototype.writeSettings = function () {
        try {
            fs.mkdirSync(vscode.workspace.rootPath + CONFIGFOLDER);
            if (DEBUG)
                console.log("Created new settings folder: " + CONFIGFOLDER);
            vscode.window.showInformationMessage("SPELL: Created a new settings file: " + CONFIGFOLDER + CONFIGFILE);
        }
        catch (e) {
            if (DEBUG)
                console.log("Folder for settings existed: " + CONFIGFOLDER);
        }
        fs.writeFileSync(vscode.workspace.rootPath + CONFIGFOLDER + CONFIGFILE, JSON.stringify(settings, null, 2));
        if (DEBUG)
            console.log("Settings written to: " + CONFIGFILE);
    };
    SpellProvider.prototype.fixOnSuggestion = function (document, diagnostic, error, suggestion) {
        if (DEBUG)
            console.log("Attempting to fix file:" + document.uri.toString());
        var docError = document.getText(diagnostic.range);
        if (error == docError) {
            // Remove diagnostic from list
            var diagnostics = diagnosticMap[document.uri.toString()];
            var index = diagnostics.indexOf(diagnostic);
            diagnostics.splice(index, 1);
            // Update with new diagnostics
            diagnosticMap[document.uri.toString()] = diagnostics;
            spellDiagnostics.set(document.uri, diagnostics);
            // Insert the new text			
            var edit = new vscode.WorkspaceEdit();
            edit.replace(document.uri, diagnostic.range, suggestion);
            return vscode.workspace.applyEdit(edit);
        }
        else {
            vscode.window.showErrorMessage('The suggestion was not applied because it is out of date.');
        }
    };
    SpellProvider.prototype.readSettings = function () {
        var cfg = readJsonFile(vscode.workspace.rootPath + CONFIGFOLDER + CONFIGFILE);
        function readJsonFile(file) {
            try {
                cfg = JSON.parse(fs.readFileSync(file).toString());
                if (DEBUG)
                    console.log("Settings read from: " + file);
            }
            catch (err) {
                if (DEBUG)
                    console.log("Default Settings");
                cfg = JSON.parse('{\
                                "version": "0.1.0", \
                                "language": "en", \
                                "ignoreWordsList": [], \
                                "mistakeTypeToStatus": { \
                                            "Passive voice": "Hint", \
                                            "Spelling": "Error", \
                                            "Complex Expression": "Disable", \
                                            "Hidden Verbs": "Information", \
                                            "Hyphen Required": "Disable", \
                                            "Redundant Expression": "Disable", \
                                            "Did you mean...": "Disable", \
                                            "Repeated Word": "Warning", \
                                            "Missing apostrophe": "Warning", \
                                            "Cliches": "Disable", \
                                            "Missing Word": "Disable", \
                                            "Make I uppercase": "Warning" \
                                    },\
                                "languageIDs": ["markdown","plaintext"],\
                                "ignoreRegExp": [ \
                                    "/\\\\(.*\\\\.(jpg|jpeg|png|md|gif|JPG|JPEG|PNG|MD|GIF)\\\\)/g", \
                                    "/((http|https|ftp|git)\\\\S*)/g" \
                                 ]\
                              }');
            }
            //gracefully handle new fields
            if (cfg.languageIDs === undefined)
                cfg.languageIDs = ["markdown"];
            if (cfg.language === undefined)
                cfg.language = "en";
            if (cfg.ignoreRegExp === undefined)
                cfg.ignoreRegExp = [];
            return cfg;
        }
        return {
            language: cfg.language,
            ignoreWordsList: cfg.ignoreWordsList,
            mistakeTypeToStatus: cfg.mistakeTypeToStatus,
            languageIDs: cfg.languageIDs,
            ignoreRegExp: cfg.ignoreRegExp
        };
    };
    SpellProvider.prototype.convertSeverity = function (mistakeType) {
        var mistakeTypeToStatus = settings.mistakeTypeToStatus;
        switch (mistakeTypeToStatus[mistakeType]) {
            case "Warning":
                return vscode.DiagnosticSeverity.Warning;
            case "Information":
                return vscode.DiagnosticSeverity.Information;
            case "Error":
                return vscode.DiagnosticSeverity.Error;
            case "Hint":
                return vscode.DiagnosticSeverity.Hint;
            default:
                return -1; // used for 'Disabled' or no setting
        }
    };
    // ATD does not return a line number and results are not in order - most code is about 'guessing' a line number
    SpellProvider.prototype.spellcheckDocument = function (content, cb) {
        var problemMessage;
        var detectedErrors = {};
        callATD.check(settings.language, content, function (error, docProblems) {
            if (error != null)
                console.log(error);
            if (docProblems != null) {
                for (var i = 0; i < docProblems.length; i++) {
                    var problem = docProblems[i];
                    var problemTXT = problem.string;
                    var problemPreContext = (typeof problem.precontext !== "object") ? problem.precontext + " " : "";
                    var problemWithPreContent = problemPreContext + problemTXT;
                    var problemSuggestions = [];
                    var startPosInFile = -1;
                    // Check to see if this error has been seen before for improved uniqueness
                    if (detectedErrors[problemWithPreContent] > 0) {
                        startPosInFile = nthOccurrence(content, problemTXT, problemPreContext, detectedErrors[problemWithPreContent] + 1);
                    }
                    else {
                        startPosInFile = nthOccurrence(content, problemTXT, problemPreContext, 1);
                    }
                    if (startPosInFile !== -1) {
                        var linesToMistake = content.substring(0, startPosInFile).split('\n');
                        var numberOfLinesToMistake = linesToMistake.length - 1;
                        if (!detectedErrors[problemWithPreContent])
                            detectedErrors[problemWithPreContent] = 1;
                        else
                            ++detectedErrors[problemWithPreContent];
                        // make the suggestions an array even if only one is returned
                        if (String(problem.suggestions) !== "undefined") {
                            if (Array.isArray(problem.suggestions.option))
                                problemSuggestions = problem.suggestions.option;
                            else
                                problemSuggestions = [problem.suggestions.option];
                        }
                        problems.push({
                            error: problemTXT,
                            preContext: problemPreContext,
                            startLine: numberOfLinesToMistake,
                            startChar: linesToMistake[numberOfLinesToMistake].length,
                            endLine: numberOfLinesToMistake,
                            endChar: linesToMistake[numberOfLinesToMistake].length + problemTXT.length,
                            type: problem.description,
                            message: problem.description + " [" + problemTXT + "] - suggest [" + problemSuggestions.join(", ") + "]",
                            suggestions: problemSuggestions
                        });
                    }
                }
                cb(problems);
            }
        });
        function nthOccurrence(content, problem, preContext, occuranceNo) {
            var firstIndex = -1;
            var regex = new RegExp(preContext + "[ ]*" + problem, "g");
            var m = regex.exec(content);
            if (m !== null) {
                var matchTXT = m[0];
                // adjust for any precontent and padding
                firstIndex = m.index + m[0].match(/^\s*/)[0].length;
                if (preContext !== "") {
                    var regex2 = new RegExp(preContext + "[ ]*", "g");
                    var m2 = regex2.exec(matchTXT);
                    firstIndex += m2[0].length;
                }
            }
            var lengthUpToFirstIndex = firstIndex + 1;
            if (occuranceNo == 1) {
                return firstIndex;
            }
            else {
                var stringAfterFirstOccurrence = content.slice(lengthUpToFirstIndex);
                var nextOccurrence = nthOccurrence(stringAfterFirstOccurrence, problem, preContext, occuranceNo - 1);
                if (nextOccurrence === -1) {
                    return -1;
                }
                else {
                    return lengthUpToFirstIndex + nextOccurrence;
                }
            }
        }
    };
    SpellProvider.prototype.removeUnwantedText = function (content) {
        var match;
        var expressions = settings.ignoreRegExp;
        for (var x = 0; x < expressions.length; x++) {
            // Convert the JSON of regExp Strings into a real RegExp
            var flags = expressions[x].replace(/.*\/([gimy]*)$/, '$1');
            var pattern = expressions[x].replace(new RegExp('^/(.*?)/' + flags + '$'), '$1');
            pattern = pattern.replace(/\\\\/g, "\\");
            var regex = new RegExp(pattern, flags);
            if (DEBUG)
                console.log("Ignoreing [" + expressions[x] + "]");
            match = content.match(regex);
            if (match !== null) {
                if (DEBUG)
                    console.log("Found [" + match.length + "] matches for removal");
                // look for a multi line match and build enough lines into the replacement
                for (var i = 0; i < match.length; i++) {
                    var spaces = void 0;
                    var lines = match[i].split("\n").length;
                    if (lines > 1) {
                        spaces = new Array(lines).join("\n");
                    }
                    else {
                        spaces = new Array(match[i].length + 1).join(" ");
                    }
                    content = content.replace(match[i], spaces);
                }
            }
        }
        return content;
    };
    SpellProvider.prototype.changeLanguage = function () {
        var _this = this;
        var items = [];
        items.push({ label: getLanguageDescription("en"), description: "en" });
        items.push({ label: getLanguageDescription("fr"), description: "fr" });
        items.push({ label: getLanguageDescription("de"), description: "de" });
        items.push({ label: getLanguageDescription("pt"), description: "pt" });
        items.push({ label: getLanguageDescription("es"), description: "es" });
        var index;
        for (var i = 0; i < items.length; i++) {
            var element = items[i];
            if (element.description == settings.language) {
                index = i;
                break;
            }
        }
        items.splice(index, 1);
        // replace the text with the selection
        vscode.window.showQuickPick(items).then(function (selection) {
            if (!selection)
                return;
            settings.language = selection.description;
            if (DEBUG)
                console.log("Attempting to change to: " + settings.language);
            _this.writeSettings();
            vscode.window.showInformationMessage("To start checking in " + getLanguageDescription(settings.language)
                + " reload window by pressing 'F1' + 'Reload Window'.");
        });
        function getLanguageDescription(initial) {
            switch (initial) {
                case "en":
                    return "English";
                case "fr":
                    return "French";
                case "de":
                    return "German";
                case "pt":
                    return "Portuguese";
                case "es":
                    return "Spanish";
                default:
                    return "English";
            }
        }
    };
    SpellProvider.addToDictionaryCmdId = 'SpellProvider.addToDictionary';
    SpellProvider.fixOnSuggestionCmdId = 'SpellProvider.fixOnSuggestion';
    SpellProvider.changeLanguageCmdId = 'SpellProvider.changeLanguage';
    return SpellProvider;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = SpellProvider;
//# sourceMappingURL=spellProvider.js.map