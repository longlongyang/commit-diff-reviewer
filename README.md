# Commit Diff Reviewer

<p align="center">
  <img src="images/icon.png" width="128" height="128" alt="Commit Diff Reviewer Logo">
</p>

<p align="center">
  <strong>Interactive Git commit review with GitHub Copilot-style UX</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=yanglonglong.commit-diff-reviewer">
    <img src="https://img.shields.io/visual-studio-marketplace/v/yanglonglong.commit-diff-reviewer?style=flat-square&label=VS%20Code%20Marketplace" alt="VS Code Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=yanglonglong.commit-diff-reviewer">
    <img src="https://img.shields.io/visual-studio-marketplace/i/yanglonglong.commit-diff-reviewer?style=flat-square" alt="Installs">
  </a>
  <a href="https://github.com/longlongyang/commit-diff-reviewer/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/longlongyang/commit-diff-reviewer?style=flat-square" alt="License">
  </a>
</p>

---

A VSCode/Cursor extension that allows you to **review any Git commit's changes interactively** - accept changes you want to keep or reject changes to revert them to the original state.

## ✨ Features

### 🎯 Commit Selection
- Quick Pick UI showing recent commits with hash, message, author, and time
- Support for manual commit hash input
- Session management with persistence

### 🎨 Visual Diff Highlighting
| Change Type | Color | Description |
|-------------|-------|-------------|
| ➕ Added | 🟢 Green | New lines added in the commit |
| ➖ Deleted | 🔴 Red | Lines removed in the commit |
| ✏️ Modified | 🟡 Yellow | Lines changed in the commit |

### 🔘 Inline Actions
Each change shows **CodeLens** buttons:
- **✓ Accept** - Keep the change (just removes highlighting)
- **✗ Reject** - Revert to original content

### ⌨️ Keyboard Navigation
| Shortcut | Action |
|----------|--------|
| `Alt+]` or `Shift+F7` | Go to next change |
| `Alt+[` or `F7` | Go to previous change |
| `Alt+A` | Accept current change |
| `Alt+R` | Reject current change |

### 📊 Status Bar
- Shows review progress: `3/15 pending (5/20 done)`
- Navigation buttons for prev/next change
- Click commit hash to end session

---

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Press `Ctrl+Shift+X` to open Extensions
3. Search for **"Commit Diff Reviewer"**
4. Click **Install**

Or install directly: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=yanglonglong.commit-diff-reviewer)

### From VSIX File

1. Download the `.vsix` file from [Releases](https://github.com/longlongyang/commit-diff-reviewer/releases)
2. In VS Code, press `Ctrl+Shift+P`
3. Run `Extensions: Install from VSIX...`
4. Select the downloaded file

---

## 🚀 Usage

1. Open a Git repository in VS Code
2. Press `Ctrl+Shift+P` and run **"Commit Diff Reviewer: Select Commit to Review"**
3. Choose a commit from the list (or enter a hash manually)
4. Review each change:
   - Click **✓ Accept** to keep the change
   - Click **✗ Reject** to revert to original
5. Use `Alt+[/]` to navigate between changes
6. When done, run **"End Review Session"**

### Commands

| Command | Description |
|---------|-------------|
| `Commit Diff Reviewer: Select Commit to Review` | Start a review session |
| `Commit Diff Reviewer: Go to Next Change` | Navigate to next change |
| `Commit Diff Reviewer: Go to Previous Change` | Navigate to previous change |
| `Commit Diff Reviewer: Accept Current Change` | Accept and keep current change |
| `Commit Diff Reviewer: Reject Current Change` | Reject and revert current change |
| `Commit Diff Reviewer: Accept All Changes` | Accept all remaining changes |
| `Commit Diff Reviewer: Reject All Changes` | Reject all remaining changes |
| `Commit Diff Reviewer: End Review Session` | End the current session |

---

## ⚙️ Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `commitDiffReviewer.maxCommitsInList` | `20` | Number of commits to show |
| `commitDiffReviewer.highlightColors.added` | `rgba(46,160,67,0.25)` | Added lines color |
| `commitDiffReviewer.highlightColors.deleted` | `rgba(248,81,73,0.25)` | Deleted lines color |
| `commitDiffReviewer.highlightColors.modified` | `rgba(210,153,34,0.25)` | Modified lines color |

---

## 🔧 Development

```bash
# Clone the repository
git clone https://github.com/longlongyang/commit-diff-reviewer.git
cd commit-diff-reviewer

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Launch Extension Development Host
# Press F5 in VS Code
```

---

## 📄 License

[MIT](LICENSE) © Yang Longlong

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a [Pull Request](https://github.com/longlongyang/commit-diff-reviewer/pulls).

## 🐛 Issues

Found a bug? Please [open an issue](https://github.com/longlongyang/commit-diff-reviewer/issues).
