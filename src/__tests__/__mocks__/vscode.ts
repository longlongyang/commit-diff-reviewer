/**
 * VSCode API Mock for testing
 */

export const workspace = {
    workspaceFolders: [
        {
            uri: { fsPath: '/mock/workspace' },
            name: 'mock-workspace',
            index: 0
        }
    ],
    getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn().mockImplementation((key: string, defaultValue: unknown) => defaultValue)
    }),
    openTextDocument: jest.fn(),
    applyEdit: jest.fn().mockResolvedValue(true),
    onDidChangeTextDocument: jest.fn()
};

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    withProgress: jest.fn().mockImplementation((_options, task) => task({ report: jest.fn() })),
    createTextEditorDecorationType: jest.fn().mockReturnValue({
        dispose: jest.fn()
    }),
    visibleTextEditors: [],
    activeTextEditor: undefined,
    onDidChangeActiveTextEditor: jest.fn(),
    showTextDocument: jest.fn(),
    createStatusBarItem: jest.fn().mockReturnValue({
        show: jest.fn(),
        hide: jest.fn(),
        dispose: jest.fn(),
        text: '',
        tooltip: '',
        command: ''
    })
};

export const commands = {
    registerCommand: jest.fn(),
    executeCommand: jest.fn()
};

export const languages = {
    registerCodeLensProvider: jest.fn()
};

export const Uri = {
    file: jest.fn().mockImplementation((path: string) => ({ fsPath: path })),
    parse: jest.fn()
};

export const Range = jest.fn().mockImplementation((startLine: number, startChar: number, endLine: number, endChar: number) => ({
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar }
}));

export const Position = jest.fn().mockImplementation((line: number, character: number) => ({
    line,
    character
}));

export const Selection = jest.fn();

export const ThemeColor = jest.fn();

export const StatusBarAlignment = {
    Left: 1,
    Right: 2
};

export const OverviewRulerLane = {
    Left: 1,
    Center: 2,
    Right: 4,
    Full: 7
};

export const TextEditorRevealType = {
    Default: 0,
    InCenter: 1,
    InCenterIfOutsideViewport: 2,
    AtTop: 3
};

export const ProgressLocation = {
    SourceControl: 1,
    Window: 10,
    Notification: 15
};

export const WorkspaceEdit = jest.fn().mockImplementation(() => ({
    delete: jest.fn(),
    insert: jest.fn(),
    replace: jest.fn()
}));

export const MarkdownString = jest.fn().mockImplementation(() => ({
    appendMarkdown: jest.fn().mockReturnThis(),
    appendCodeblock: jest.fn().mockReturnThis()
}));

export const EventEmitter = jest.fn().mockImplementation(() => ({
    event: jest.fn(),
    fire: jest.fn(),
    dispose: jest.fn()
}));

export const extensions = {
    getExtension: jest.fn()
};
