from rest_framework.response import Response


def ok(data=None, status: int = 200) -> Response:
    """`{"success": true, "data": ...}`, the envelope for a single resource or action result."""
    body: dict = {"success": True}
    if data is not None:
        body["data"] = data
    return Response(body, status=status)
