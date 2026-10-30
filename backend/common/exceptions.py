"""
Every error leaves the API as `{"success": false, "detail": "...", "errors"?: {...}, "code"?: "..."}`.

`detail` is one readable sentence for a toast. `errors` keeps field messages
for forms (the frontend's applyServerErrors). `code` is the machine-readable
reason when DRF has one, such as `not_authenticated` or `throttled`.
"""

from rest_framework.exceptions import APIException, ValidationError
from rest_framework.views import exception_handler


def _flatten(data) -> str:
    if isinstance(data, list):
        return " ".join(_flatten(item) for item in data if item not in ("", None))
    if isinstance(data, dict):
        parts = []
        for key, value in data.items():
            text = _flatten(value)
            if not text:
                continue
            parts.append(text if key in {"detail", "non_field_errors"} else f"{key}: {text}")
        return " ".join(parts)
    return str(data)


def _field_errors(data) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    for field, messages in data.items():
        if field == "non_field_errors":
            continue
        items = messages if isinstance(messages, list) else [messages]
        errors[field] = [_flatten(item) for item in items]
    return errors


def api_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is None:
        return None
    body: dict = {"success": False, "detail": _flatten(response.data) or "Request failed."}
    if isinstance(exc, ValidationError) and isinstance(response.data, dict):
        field_errors = _field_errors(response.data)
        if field_errors:
            body["errors"] = field_errors
        non_field = response.data.get("non_field_errors")
        body["detail"] = (
            _flatten(non_field)
            if non_field
            else next((messages[0] for messages in field_errors.values() if messages), body["detail"])
        )
    elif isinstance(exc, APIException):
        codes = exc.get_codes()
        if isinstance(codes, str):
            body["code"] = codes
    response.data = body
    return response
