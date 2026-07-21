from __future__ import annotations

import pytest

from canvas_import.canvas.new_quizzes import NewQuizApiError, NewQuizClient


class FakeResponse:
    def __init__(self, payload, *, next_url=None):
        self.payload = payload
        self.status_code = 200
        self.links = {"next": {"url": next_url}} if next_url else {}

    def raise_for_status(self):
        return None

    def json(self):
        return self.payload


class FakeSession:
    def __init__(self, responses):
        self.headers = {}
        self.responses = list(responses)
        self.calls = []

    def request(self, method, url, **kwargs):
        self.calls.append((method, url, kwargs))
        return self.responses.pop(0)


def test_list_items_follows_same_origin_pagination():
    session = FakeSession(
        [
            FakeResponse(
                [{"id": "1"}],
                next_url="https://canvas.example.instructure.com/api/quiz/v1/courses/10/quizzes/20/items?page=2",
            ),
            FakeResponse([{"id": "2"}]),
        ]
    )
    client = NewQuizClient("https://canvas.example.instructure.com", "token", session=session)

    assert client.list_items("10", "20") == [{"id": "1"}, {"id": "2"}]
    assert {method for method, _, _ in session.calls} == {"GET"}
    assert session.headers["Authorization"] == "Bearer token"


def test_cross_origin_pagination_is_rejected():
    session = FakeSession(
        [FakeResponse([{"id": "1"}], next_url="https://attacker.example/items?page=2")]
    )
    client = NewQuizClient("https://canvas.example.instructure.com", "token", session=session)

    with pytest.raises(NewQuizApiError, match="cross-origin"):
        client.list_items("10", "20")


def test_update_item_wraps_canvas_json_shape():
    session = FakeSession([FakeResponse({"id": "30"})])
    client = NewQuizClient("https://canvas.example.instructure.com", "token", session=session)

    result = client.update_item("10", "20", "30", {"points_possible": 4})

    assert result == {"id": "30"}
    assert session.calls[0][0] == "PATCH"
    assert session.calls[0][2]["json"] == {"item": {"points_possible": 4}}


def test_unrecognized_success_payload_is_not_silently_treated_as_empty():
    session = FakeSession([FakeResponse({"unexpected": []})])
    client = NewQuizClient("https://canvas.example.instructure.com", "token", session=session)

    with pytest.raises(NewQuizApiError, match="no items or quizzes"):
        client.list_items("10", "20")
