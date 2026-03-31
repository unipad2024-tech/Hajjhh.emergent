"""
Paylink.sa Payment Service
Docs: https://developer.paylink.sa
"""
import httpx
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

PAYLINK_BASE_URL = "https://restapi.paylink.sa"

PAYLINK_API_ID   = os.environ.get("PAYMENT_API_ID", "")
PAYLINK_SECRET   = os.environ.get("PAYMENT_API_KEY", "")


async def _get_auth_token() -> str:
    """
    Authenticate with Paylink and return a Bearer token.
    POST /api/auth  →  { id_token }
    """
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            f"{PAYLINK_BASE_URL}/api/auth",
            json={
                "apiId": PAYLINK_API_ID,
                "secretKey": PAYLINK_SECRET,
                "persistToken": False,
            },
            headers={"Accept": "application/json", "Content-Type": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        token = data.get("id_token", "")
        if not token:
            raise ValueError(f"Paylink auth failed: {data}")
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
    Create a Paylink invoice and return the response.
    Returns dict with keys: url, transactionNo, qrUrl, mobileUrl, checkUrl, success
    """
    token = await _get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
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

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{PAYLINK_BASE_URL}/api/addInvoice",
            json=payload,
            headers=headers,
        )
        data = resp.json()
        if resp.status_code not in (200, 201) or not data.get("success"):
            logger.error(f"Paylink addInvoice error: {data}")
            raise ValueError(data.get("detail") or str(data))
        return data


async def get_invoice_status(transaction_no: str) -> dict:
    """
    Check the status of a Paylink invoice.
    Returns dict with keys: orderStatus (Pending|Paid|Canceled), amount, transactionNo
    """
    token = await _get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{PAYLINK_BASE_URL}/api/getInvoice/{transaction_no}",
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()
