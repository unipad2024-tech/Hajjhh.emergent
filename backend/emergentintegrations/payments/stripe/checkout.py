"""Stub for emergentintegrations.payments.stripe.checkout — local dev only."""
from pydantic import BaseModel
from typing import Optional


class CheckoutSessionRequest(BaseModel):
    amount: float
    currency: str = "sar"
    success_url: str
    cancel_url: str
    metadata: Optional[dict] = None


class CheckoutSessionResponse(BaseModel):
    session_id: str
    url: str


class CheckoutStatusResponse(BaseModel):
    session_id: str
    status: str
    payment_status: Optional[str] = None


class StripeCheckout:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def create_session(self, req: CheckoutSessionRequest) -> CheckoutSessionResponse:
        return CheckoutSessionResponse(
            session_id="stub_session",
            url="https://checkout.stripe.com/stub"
        )

    async def get_session_status(self, session_id: str) -> CheckoutStatusResponse:
        return CheckoutStatusResponse(
            session_id=session_id,
            status="open",
            payment_status="unpaid"
        )
