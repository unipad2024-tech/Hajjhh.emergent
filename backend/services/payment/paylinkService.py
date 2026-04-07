"""
Paylink.sa Payment Service
Docs: https://developer.paylink.sa
"""
import httpx
import logging
import os

logger = logging.getLogger(__name__)

PAYLINK_BASE_URL = "https://restapi.paylink.sa"


def _credentials() -> tuple[str, str]:
    """Read credentials lazily (after load_dotenv has been called in server.py)."""
    api_id = os.environ.get("PAYMENT_API_ID", "")
    secret = os.environ.get("PAYMENT_API_KEY", "")
    return api_id, secret


async def _get_auth_token() -> str:
    """
    Authenticate with Paylink and return a Bearer token (id_token).
    POST /api/auth  →  { id_token }
    """
    api_id, secret = _credentials()
    if not api_id or not secret:
        raise ValueError("PAYMENT_API_ID / PAYMENT_API_KEY not configured")

    async with httpx.AsyncClient(timeout=30, verify=True) as client:
        resp = await client.post(
            f"{PAYLINK_BASE_URL}/api/auth",
            json={
                "apiId":        api_id,
                "secretKey":    secret,
                "persistToken": False,
            },
            headers={
                "Accept":       "application/json",
                "Content-Type": "application/json",
            },
        )
        if resp.status_code != 200:
            body = resp.text[:300]
            raise ValueError(f"Paylink auth failed (HTTP {resp.status_code}): {body}")

        data = resp.json()
        token = data.get("id_token", "")
        if not token:
            raise ValueError(f"Paylink auth: no id_token in response: {data}")
        return token


async def create_invoice(
    *,
    amount: float,
    order_number: str,
    client_name: str,
    client_mobile: str,
    callback_url: str,
    cancel_url: str,
    client_email: str = "",
    note: str = "",
) -> dict:
    """
    Create a Paylink invoice and return the response dict.
    Keys: url (redirect), transactionNo, success, ...
    """
    token = await _get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept":        "application/json",
        "Content-Type":  "application/json",
    }
    payload = {
        "orderNumber":  order_number,
        "amount":       float(amount),
        "callBackUrl":  callback_url,
        "cancelUrl":    cancel_url,
        "clientName":   client_name,
        "clientMobile": client_mobile,
        "currency":     "SAR",
        "note":         note or "اشتراك حُجّة Premium",
        "products": [
            {
                "title":     "اشتراك حُجّة Premium",
                "price":     float(amount),
                "qty":       1,
                "isDigital": True,
            }
        ],
        "supportedCardBrands": ["mada", "visaMastercard", "stcpay"],
        "displayPending": True,
    }
    if client_email:
        payload["clientEmail"] = client_email

    async with httpx.AsyncClient(timeout=30, verify=True) as client:
        resp = await client.post(
            f"{PAYLINK_BASE_URL}/api/addInvoice",
            json=payload,
            headers=headers,
        )
        data = resp.json()
        if resp.status_code not in (200, 201) or not data.get("success"):
            logger.error(f"Paylink addInvoice error ({resp.status_code}): {data}")
            raise ValueError(data.get("detail") or data.get("message") or str(data)[:200])
        return data


async def get_invoice_status(transaction_no: str) -> dict:
    """
    Check the status of a Paylink invoice.
    Returns dict with keys: orderStatus (Pending|Paid|Canceled), amount, transactionNo
    """
    token = await _get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept":        "application/json",
        "Content-Type":  "application/json",
    }
    async with httpx.AsyncClient(timeout=30, verify=True) as client:
        resp = await client.get(
            f"{PAYLINK_BASE_URL}/api/getInvoice/{transaction_no}",
            headers=headers,
        )
        if resp.status_code != 200:
            raise ValueError(f"Paylink getInvoice HTTP {resp.status_code}: {resp.text[:200]}")
        return resp.json()
