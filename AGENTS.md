# Agent Directives & Local Access Rules (Antigravity 2.0)

## System & Local Environment Directives
- **Local Machine Access**: The agent is authorized to interact with the local filesystem, including reading, copying, and referencing files from user directories outside the workspace (such as `C:\Users\abdul\Downloads`, Desktop, and local storage drives `C:\`, `D:\`).
- **File Ingestion & Sync**: When the user requests files or resources from the Downloads folder or external directories, access them using PowerShell terminal utilities (`Get-ChildItem`, `Copy-Item`, etc.) or project-relative staging paths.
- **Workflow Automation**: Automate tasks seamlessly within `d:\ai  clander project` while maintaining project integrity and clean organization.
