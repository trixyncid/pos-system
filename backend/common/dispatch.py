"""Work that should not hold up a response: run it after the transaction commits, on a small thread pool."""

from __future__ import annotations

import logging
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

from django.db import close_old_connections, transaction

logger = logging.getLogger(__name__)

_executor: ThreadPoolExecutor | None = None
_executor_lock = threading.Lock()


def _pool() -> ThreadPoolExecutor:
    global _executor
    if _executor is None:
        with _executor_lock:
            if _executor is None:
                _executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="dispatch")
    return _executor


def _call(callback) -> None:
    try:
        callback()
    except Exception:
        logger.exception("Deferred task failed")


def _run(callback) -> None:
    """On a worker thread: use a fresh connection and do not keep it open after."""
    close_old_connections()
    try:
        _call(callback)
    finally:
        close_old_connections()


def after_commit(callback) -> None:
    """
    Run `callback` after the current transaction commits.

    Two threads in the API process are enough for this app; add Celery only
    when reports or exports need a real queue.
    """

    def wrapped():
        if "test" in sys.argv:
            # Same thread as the test, so the connection is the test's own:
            # closing it would break the rest of the test on Postgres.
            _call(callback)
            return
        _pool().submit(_run, callback)

    transaction.on_commit(wrapped)
