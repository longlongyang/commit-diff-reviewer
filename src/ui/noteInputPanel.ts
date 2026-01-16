
import * as vscode from 'vscode';
import { ReviewNote } from '../models/types';
import * as path from 'path';

export class NoteInputPanel {
    public static currentPanel: NoteInputPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private onSaveCallback?: (content: string) => void;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, initialContent: string, title: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update(initialContent, title);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'save':
                        if (this.onSaveCallback) {
                            this.onSaveCallback(message.text);
                        }
                        this.dispose();
                        return;
                    case 'cancel':
                        this.dispose();
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    public static createOrShow(
        extensionUri: vscode.Uri,
        initialContent: string = '',
        title: string = 'Add Note',
        onSave: (content: string) => void
    ) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (NoteInputPanel.currentPanel) {
            NoteInputPanel.currentPanel._panel.reveal(column);
            NoteInputPanel.currentPanel._update(initialContent, title);
            NoteInputPanel.currentPanel.onSaveCallback = onSave;
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'noteInput',
            title,
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,
                // And restrict the webview to only loading content from our extension's media directory.
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        NoteInputPanel.currentPanel = new NoteInputPanel(panel, extensionUri, initialContent, title);
        NoteInputPanel.currentPanel.onSaveCallback = onSave;
    }

    public dispose() {
        NoteInputPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(content: string, title: string) {
        this._panel.title = title;
        this._panel.webview.html = this._getHtmlForWebview(content);
    }

    private _getHtmlForWebview(content: string) {
        // Use a strict Content-Security-Policy
        // Basic minimal HTML with a textarea and Save/Cancel buttons

        // Escape content for HTML
        const safeContent = content.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Review Note</title>
            <style>
                body {
                    padding: 20px;
                    font-family: var(--vscode-font-family);
                    color: var(--vscode-editor-foreground);
                    background-color: var(--vscode-editor-background);
                }
                textarea {
                    width: 100%;
                    height: 200px;
                    padding: 10px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    resize: vertical;
                    font-family: monospace;
                    margin-bottom: 20px;
                }
                button {
                    padding: 8px 16px;
                    border: none;
                    cursor: pointer;
                    font-weight: bold;
                    margin-right: 10px;
                }
                #saveBtn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                #saveBtn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                #cancelBtn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                #cancelBtn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                h3 {
                    margin-top: 0;
                }
            </style>
        </head>
        <body>
            <h3>${this._panel.title}</h3>
            <textarea id="noteContent" placeholder="Enter markdown note...">${safeContent}</textarea>
            <div style="display: flex; justify-content: flex-end;">
                <button id="cancelBtn" onclick="cancel()">Cancel</button>
                <button id="saveBtn" onclick="save()">Save Note</button>
            </div>

            <script>
                const vscode = acquireVsCodeApi();
                const textarea = document.getElementById('noteContent');
                
                // Focus textarea
                textarea.focus();

                function save() {
                    const text = textarea.value;
                    vscode.postMessage({
                        command: 'save',
                        text: text
                    });
                }

                function cancel() {
                    vscode.postMessage({
                        command: 'cancel'
                    });
                }
                
                // Ctrl+Enter to save
                textarea.addEventListener('keydown', (e) => {
                    if ((e.ctrlKey || e.metaKey) && e.code === 'Enter') {
                        save();
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
