from rest_framework.response import Response

_NO_DATA = object()


def ok(data=_NO_DATA, status: int = 200) -> Response:
    """
    `{"success": true, "data": ...}`, the envelope for a single resource or
    action result. `ok()` sends no data key; `ok(None)` sends `"data": null`.
    """
    body: dict = {"success": True}
    if data is not _NO_DATA:
        body["data"] = data
    return Response(body, status=status)
