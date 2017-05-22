"use strict";
const child_process = require('child_process');
const path = require("path");
const fs = require("fs");
const vscode = require("vscode");
const settings = require("./../common/configSettings");
const utils = require("../common/utils");
const helpers_1 = require('../common/helpers');
// where to find the Python binary within a conda env
const CONDA_RELATIVE_PY_PATH = utils.IS_WINDOWS ? ['python'] : ['bin', 'python'];
const CHECK_PYTHON_INTERPRETER_REGEXP = utils.IS_WINDOWS ? /^python(\d+(.\d+)?)?\.exe$/ : /^python(\d+(.\d+)?)?$/;
function getSearchPaths() {
    if (utils.IS_WINDOWS) {
        const localAppData = process.env['LOCALAPPDATA'];
        const appData = process.env['APPDATA'];
        const lookupParentDirectories = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'],
            localAppData, appData,
            process.env['SystemDrive']];
        if (appData) {
            lookupParentDirectories.push(path.join(localAppData, 'Programs'));
        }
        if (localAppData) {
            lookupParentDirectories.push(path.join(appData, 'Programs'));
        }
        if (settings.PythonSettings.getInstance().venvPath) {
            lookupParentDirectories.push(settings.PythonSettings.getInstance().venvPath);
        }
        const dirPromises = lookupParentDirectories.map(rootDir => {
            if (!rootDir) {
                return Promise.resolve([]);
            }
            const def = helpers_1.createDeferred();
            fs.readdir(rootDir, (error, files) => {
                if (error) {
                    return def.resolve([]);
                }
                const possiblePythonDirs = [];
                files.forEach(name => {
                    const fullPath = path.join(rootDir, name);
                    try {
                        if ((name.toUpperCase().indexOf('PYTHON') >= 0 || name.toUpperCase().indexOf('ANACONDA') >= 0) &&
                            fs.statSync(fullPath).isDirectory()) {
                            possiblePythonDirs.push(fullPath);
                        }
                    }
                    catch (ex) {
                    }
                });
                def.resolve(possiblePythonDirs);
            });
            return def.promise;
        });
        return Promise.all(dirPromises).then(validPathsCollection => {
            return validPathsCollection.reduce((previousValue, currentValue) => previousValue.concat(currentValue), []);
        });
    }
    else {
        const paths = ['/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin', '/usr/local/sbin', '/Envs', '/.virtualenvs', '/.pyenv'];
        // Add support for paths such as /Users/xxx/anaconda/bin
        if (process.env['HOME']) {
            paths.push(path.join(process.env['HOME'], 'anaconda', 'bin'));
            paths.push(path.join(process.env['HOME'], 'python', 'bin'));
        }
        if (settings.PythonSettings.getInstance().venvPath) {
            paths.push(settings.PythonSettings.getInstance().venvPath);
        }
        return Promise.resolve(paths);
    }
}
function activateSetInterpreterProvider() {
    return vscode.commands.registerCommand("python.setInterpreter", setInterpreter);
}
exports.activateSetInterpreterProvider = activateSetInterpreterProvider;
function lookForInterpretersInPath(pathToCheck) {
    return new Promise(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(pathToCheck, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            const interpreters = subDirs
                .filter(subDir => CHECK_PYTHON_INTERPRETER_REGEXP.test(subDir))
                .map(subDir => path.join(pathToCheck, subDir));
            resolve(interpreters);
        });
    });
}
function lookForInterpretersInVirtualEnvs(pathToCheck) {
    return new Promise(resolve => {
        // Now look for Interpreters in this directory
        fs.readdir(pathToCheck, (err, subDirs) => {
            if (err) {
                return resolve([]);
            }
            const envsInterpreters = [];
            const promises = subDirs.map(subDir => {
                subDir = path.join(pathToCheck, subDir);
                const interpreterFolder = utils.IS_WINDOWS ? path.join(subDir, 'scripts') : path.join(subDir, 'bin');
                return lookForInterpretersInPath(interpreterFolder);
            });
            Promise.all(promises).then(pathsWithInterpreters => {
                pathsWithInterpreters.forEach(interpreters => {
                    interpreters.map(interpter => {
                        envsInterpreters.push({
                            label: path.basename(interpter), path: interpter, type: ''
                        });
                    });
                });
                resolve(envsInterpreters);
            });
        });
    });
}
function suggestionsFromKnownPaths() {
    return getSearchPaths().then(paths => {
        const promises = paths.map(p => {
            return utils.validatePath(p).then(validatedPath => {
                if (validatedPath.length === 0) {
                    return Promise.resolve([]);
                }
                return lookForInterpretersInPath(validatedPath);
            });
        });
        return Promise.all(promises).then(listOfInterpreters => {
            const suggestions = [];
            const interpreters = listOfInterpreters.reduce((previous, current) => previous.concat(current), []);
            interpreters.filter(interpter => interpter.length > 0).map(interpter => {
                suggestions.push({
                    label: path.basename(interpter), path: interpter, type: ''
                });
            });
            return suggestions;
        });
    });
}
function suggestionsFromConda() {
    return new Promise((resolve, reject) => {
        // interrogate conda (if it's on the path) to find all environments
        child_process.execFile('conda', ['info', '--json'], (error, stdout, stderr) => {
            try {
                const info = JSON.parse(stdout);
                // envs reported as e.g.: /Users/bob/miniconda3/envs/someEnv
                const envs = info['envs'];
                // The root of the conda environment is itself a Python interpreter
                envs.push(info["default_prefix"]);
                const suggestions = envs.map(env => ({
                    label: path.basename(env),
                    path: path.join(env, ...CONDA_RELATIVE_PY_PATH),
                    type: 'conda',
                }));
                resolve(suggestions);
            }
            catch (e) {
                // Failed because either:
                //   1. conda is not installed
                //   2. `conda info --json` has changed signature
                //   3. output of `conda info --json` has changed in structure
                // In all cases, we can't offer conda pythonPath suggestions.
                return resolve([]);
            }
        });
    });
}
function suggestionToQuickPickItem(suggestion) {
    let detail = suggestion.path;
    if (suggestion.path.startsWith(vscode.workspace.rootPath)) {
        detail = `.${path.sep}` + path.relative(vscode.workspace.rootPath, suggestion.path);
    }
    detail = utils.IS_WINDOWS ? detail.replace(/\\/g, "/") : detail;
    return {
        label: suggestion.label,
        description: suggestion.type,
        detail: detail,
        path: utils.IS_WINDOWS ? suggestion.path.replace(/\\/g, "/") : suggestion.path
    };
}
function suggestPythonPaths() {
    // For now we only interrogate conda for suggestions.
    const condaSuggestions = suggestionsFromConda();
    const knownPathSuggestions = suggestionsFromKnownPaths();
    const virtualEnvSuggestions = lookForInterpretersInVirtualEnvs(vscode.workspace.rootPath);
    // Here we could also look for virtualenvs/default install locations...
    return Promise.all([condaSuggestions, knownPathSuggestions, virtualEnvSuggestions]).then(suggestions => {
        const quickPicks = [];
        suggestions.forEach(list => {
            quickPicks.push(...list.map(suggestionToQuickPickItem));
        });
        return quickPicks;
    });
}
function setPythonPath(pythonPath, created = false) {
    if (pythonPath.startsWith(vscode.workspace.rootPath)) {
        pythonPath = path.join('${workspaceRoot}', path.relative(vscode.workspace.rootPath, pythonPath));
    }
    const pythonConfig = vscode.workspace.getConfiguration('python');
    pythonConfig.update('pythonPath', pythonPath).then(() => {
        //Done
    }, reason => {
        vscode.window.showErrorMessage(`Failed to set 'pythonPath'. Error: ${reason.message}`);
        console.error(reason);
    });
}
function presentQuickPickOfSuggestedPythonPaths() {
    let currentPythonPath = settings.PythonSettings.getInstance().pythonPath;
    if (currentPythonPath.startsWith(vscode.workspace.rootPath)) {
        currentPythonPath = `.${path.sep}` + path.relative(vscode.workspace.rootPath, currentPythonPath);
    }
    const quickPickOptions = {
        matchOnDetail: true,
        matchOnDescription: false,
        placeHolder: `current: ${currentPythonPath}`
    };
    suggestPythonPaths().then(suggestions => {
        suggestions = suggestions.sort((a, b) => a.path > b.path ? 1 : -1);
        vscode.window.showQuickPick(suggestions, quickPickOptions).then(value => {
            if (value !== undefined) {
                setPythonPath(value.path);
            }
        });
    });
}
function setInterpreter() {
    if (typeof vscode.workspace.rootPath !== 'string') {
        return vscode.window.showErrorMessage('Please open a workspace to select the Python Interpreter');
    }
    presentQuickPickOfSuggestedPythonPaths();
}
//# sourceMappingURL=setInterpreterProvider.js.map