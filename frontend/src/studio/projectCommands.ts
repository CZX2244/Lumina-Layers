/**
 * Project actions requested from outside the project toolbar (home page,
 * command palette, file drops). ProjectWorkspace performs them with its own
 * unsaved-change guard, so every entry point behaves the same.
 * 从工程工具栏之外发起的工程操作；由 ProjectWorkspace 统一执行（含未保存提示）。
 */
export const PROJECT_COMMAND_EVENT = "lumina-plus:project-command";

export type ProjectCommand =
  | { action: "open" | "save" | "saveAs" | "new" | "center" | "export" }
  | { action: "openEntry"; entryId: string }
  | { action: "openFile"; file: File };

export function requestProjectCommand(command: ProjectCommand): void {
  window.dispatchEvent(new CustomEvent<ProjectCommand>(PROJECT_COMMAND_EVENT, { detail: command }));
}
