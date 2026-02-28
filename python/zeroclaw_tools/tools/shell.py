"""
Shell execution tool.
"""

import shlex
import subprocess

from langchain_core.tools import tool

MAX_OUTPUT_BYTES = 1_000_000


@tool
def shell(command: str) -> str:
    """
    Execute a shell command and return the output.

    Args:
        command: The shell command to execute

    Returns:
        The command output (stdout and stderr combined)
    """
    try:
        args = shlex.split(command)
        if not args:
            return "Error: empty command"
        result = subprocess.run(
            args,
            shell=False,
            capture_output=True,
            text=True,
            timeout=60,
        )
        output = result.stdout[:MAX_OUTPUT_BYTES]
        if result.stderr:
            output += f"\nSTDERR: {result.stderr[:MAX_OUTPUT_BYTES]}"
        if result.returncode != 0:
            output += f"\nExit code: {result.returncode}"
        return output or "(no output)"
    except subprocess.TimeoutExpired:
        return "Error: Command timed out after 60 seconds"
    except Exception as e:
        return f"Error: {e}"
