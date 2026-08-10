"""Regression coverage for audit-log redaction."""

from coworker.audit import AuditStore


def test_audit_store_redacts_nested_credentials_and_bodies(tmp_path):
    values = (
        "Bearer top-secret",
        "session=very-secret",
        "api-key-secret",
        "credential-secret",
        "-----BEGIN PRIVATE KEY-----",
        "confidential request body",
    )
    store = AuditStore(tmp_path / "coworker.db")
    try:
        store.append(
            {
                "tool": "http_request",
                "arguments": {
                    "url": "https://example.test/api",
                    "headers": {"Authorization": values[0], "Cookie": values[1]},
                    "config": {"api_key": values[2], "credential": values[3]},
                    "requests": [{"private_key": values[4], "request_body": values[5]}],
                },
            }
        )
        event = store.list()[0]
        assert event["args"]["headers"] == {
            "Authorization": "[redacted]",
            "Cookie": "[redacted]",
        }
        assert event["args"]["config"] == {
            "api_key": "[redacted]",
            "credential": "[redacted]",
        }
        assert event["args"]["requests"] == [
            {"private_key": "[redacted]", "request_body": "[redacted body]"}
        ]
        persisted_args = store._conn.execute("SELECT args FROM audit_events").fetchone()[0]
        for secret in values:
            assert secret not in persisted_args
    finally:
        store.close()
