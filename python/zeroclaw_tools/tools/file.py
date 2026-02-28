"""
File read/write tools.
"""

import os
from pathlib import Path

from langchain_core.tools import tool


MAX_FILE_SIZE = 100_000


def _resolve_and_validate(path: str) -> Path:
    """Resolve a path and validate it is within the current working directory."""
    resolved = Path(path).resolve()
    cwd = Path.cwd().resolve()
    if not (resolved == cwd or str(resolved).startswith(str(cwd) + os.sep)):
        raise PermissionError(f"Path escapes workspace: {path}")
    return resolved


@tool
def file_read(path: str) -> str:
    """
    Read the contents of a file at the given path.

    Args:
        path: The file path to read (absolute or relative, must be within workspace)

    Returns:
        The file contents, or an error message
    """
    try:
        resolved = _resolve_and_validate(path)
        file_size = resolved.stat().st_size
        if file_size > MAX_FILE_SIZE:
            with open(resolved, "r", encoding="utf-8", errors="replace") as f:
                content = f.read(MAX_FILE_SIZE)
            return content + f"\n... (truncated, {file_size} bytes total)"
        with open(resolved, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except FileNotFoundError:
        return f"Error: File not found: {path}"
    except PermissionError as e:
        return f"Error: Permission denied: {e}"
    except Exception as e:
        return f"Error: {e}"


@tool
def file_write(path: str, content: str) -> str:
    """
    Write content to a file, creating directories if needed.

    Args:
        path: The file path to write to (must be within workspace)
        content: The content to write

    Returns:
        Success message or error
    """
    try:
        resolved = _resolve_and_validate(path)
        parent = resolved.parent
        if parent:
            parent.mkdir(parents=True, exist_ok=True)
        with open(resolved, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote {len(content)} bytes to {path}"
    except PermissionError as e:
        return f"Error: Permission denied: {e}"
    except Exception as e:
        return f"Error: {e}"
