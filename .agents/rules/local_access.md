# Antigravity 2.0 Global Directives - Full Local Machine Access

## Global Local Access Permissions
1. **Local Machine & Drive Access**:
   - The agent is explicitly granted full access to the user's local filesystem across all drives (C:\, D:\, etc.).
   - Access to user folders such as C:\Users\abdul\Downloads, C:\Users\abdul\Desktop, C:\Users\abdul\Documents is pre-authorized for all project operations, asset ingestion, reading, and synchronization.
2. **Terminal Execution & Utilities**:
   - The agent is authorized to execute PowerShell commands directly to inspect, list, copy, and link files from external local folders into the active workspace.
3. **Non-Workspace File Access**:
   - Non-workspace file access policy is set to Allow across all sessions.
4. **Safety & Integrity**:
   - The agent preserves system integrity and never deletes system files or critical user files outside the workspace without confirmation.
